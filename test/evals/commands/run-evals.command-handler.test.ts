import { TestBed } from '@automock/jest';
import { RunEvalsCommandHandler } from '../../../src/evals/commands/run-evals.command-handler';
import { RunEvalsCommand } from '../../../src/evals/commands/run-evals.command';
import { EvalGoldenSetService } from '../../../src/evals/golden-set/eval-golden-set.service';
import { RAGService } from '../../../src/bookmarks/rag/rag.service';
import { EvalJudgeService } from '../../../src/evals/judge/eval-judge.service';
import { EvalsRepository } from '../../../src/evals/evals.repository';
import type { EvalRunSelect } from '../../../src/schema/eval-runs.schema';
import type { GoldenCase } from '../../../src/evals/evals.types';

const CREATED_AT = new Date('2026-05-29T00:00:00Z');

const GOLDEN_CASES: GoldenCase[] = [
  { question: 'What are Kafka consumer groups?', expectedTopics: ['partition assignment', 'rebalancing'], expectedSourceTag: 'kafka' },
  { question: 'How does pgvector work?', expectedTopics: ['cosine distance', 'HNSW index'], expectedSourceTag: 'pgvector' },
];

const RAG_RESULT = { answer: 'Consumer groups enable parallel consumption.', contextChunks: ['[https://kafka.apache.org] Kafka partitions.'] };

const JUDGE_RESULT = { relevance: 0.9, faithfulness: 0.85, reasoning: 'Good coverage of expected topics.' };

const makeStoredRun = (overrides: Partial<EvalRunSelect> = {}): EvalRunSelect => ({
  id: 'run-uuid-001',
  goldenQuestion: 'What are Kafka consumer groups?',
  expectedTopics: ['partition assignment', 'rebalancing'],
  expectedSourceTag: 'kafka',
  answer: RAG_RESULT.answer,
  contextChunks: RAG_RESULT.contextChunks,
  relevanceScore: 0.9,
  faithfulnessScore: 0.85,
  reasoning: 'Good coverage of expected topics.',
  createdAt: CREATED_AT,
  ...overrides,
});

describe('RunEvalsCommandHandler Unit Test', () => {
  let sut: RunEvalsCommandHandler;
  let goldenSetService: jest.Mocked<EvalGoldenSetService>;
  let ragService: jest.Mocked<RAGService>;
  let evalJudgeService: jest.Mocked<EvalJudgeService>;
  let evalsRepository: jest.Mocked<EvalsRepository>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(RunEvalsCommandHandler).compile();
    sut = unit;
    goldenSetService = unitRef.get(EvalGoldenSetService);
    ragService = unitRef.get(RAGService);
    evalJudgeService = unitRef.get(EvalJudgeService);
    evalsRepository = unitRef.get(EvalsRepository);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given execute, When all cases succeed', () => {
    test('Then it scores each case and returns a summary with correct averages', async () => {
      const run1 = makeStoredRun({ id: 'run-uuid-001' });
      const run2 = makeStoredRun({ id: 'run-uuid-002', goldenQuestion: 'How does pgvector work?', expectedTopics: ['cosine distance', 'HNSW index'], expectedSourceTag: 'pgvector', relevanceScore: 0.6, faithfulnessScore: 0.65, reasoning: 'Partially covered.' });

      goldenSetService.load.mockReturnValue(GOLDEN_CASES);
      ragService.execute.mockResolvedValue(RAG_RESULT);
      evalJudgeService.score.mockResolvedValueOnce(JUDGE_RESULT).mockResolvedValueOnce({ relevance: 0.6, faithfulness: 0.65, reasoning: 'Partially covered.' });
      evalsRepository.insert.mockResolvedValueOnce(run1).mockResolvedValueOnce(run2);

      const result = await sut.execute(new RunEvalsCommand());

      expect(result.totalCases).toBe(2);
      expect(result.avgRelevance).toBe(0.75);
      expect(result.avgFaithfulness).toBe(0.75);
      expect(result.weakCases).toEqual([
        { question: 'How does pgvector work?', relevanceScore: 0.6, faithfulnessScore: 0.65 },
      ]);
      expect(result.runs).toHaveLength(2);

      expect(ragService.execute).toHaveBeenCalledTimes(2);
      expect(ragService.execute).toHaveBeenCalledWith('What are Kafka consumer groups?');
      expect(ragService.execute).toHaveBeenCalledWith('How does pgvector work?');

      expect(evalsRepository.insert).toHaveBeenCalledWith({
        goldenQuestion: 'What are Kafka consumer groups?',
        expectedTopics: ['partition assignment', 'rebalancing'],
        expectedSourceTag: 'kafka',
        answer: RAG_RESULT.answer,
        contextChunks: RAG_RESULT.contextChunks,
        relevanceScore: 0.9,
        faithfulnessScore: 0.85,
        reasoning: 'Good coverage of expected topics.',
      });
    });
  });

  describe('Given execute, When a case throws during RAG', () => {
    test('Then it skips the failing case and includes the remaining cases in the summary', async () => {
      const run2 = makeStoredRun({ id: 'run-uuid-002', goldenQuestion: 'How does pgvector work?', expectedTopics: ['cosine distance', 'HNSW index'], expectedSourceTag: 'pgvector' });

      goldenSetService.load.mockReturnValue(GOLDEN_CASES);
      ragService.execute
        .mockRejectedValueOnce(new Error('Vector DB unavailable'))
        .mockResolvedValueOnce(RAG_RESULT);
      evalJudgeService.score.mockResolvedValue(JUDGE_RESULT);
      evalsRepository.insert.mockResolvedValue(run2);

      const result = await sut.execute(new RunEvalsCommand());

      expect(result.totalCases).toBe(1);
      expect(result.runs[0]?.goldenQuestion).toBe('How does pgvector work?');
    });
  });

  describe('Given execute, When all cases fail', () => {
    test('Then it returns a zero-score summary with no runs or weak cases', async () => {
      goldenSetService.load.mockReturnValue(GOLDEN_CASES);
      ragService.execute.mockRejectedValue(new Error('Service down'));

      const result = await sut.execute(new RunEvalsCommand());

      expect(result.totalCases).toBe(0);
      expect(result.avgRelevance).toBe(0);
      expect(result.avgFaithfulness).toBe(0);
      expect(result.weakCases).toEqual([]);
      expect(result.runs).toEqual([]);
    });
  });

  describe('Given execute, When all cases score above threshold', () => {
    test('Then weakCases is empty', async () => {
      const run1 = makeStoredRun({ relevanceScore: 0.95, faithfulnessScore: 0.95 });
      const run2 = makeStoredRun({ id: 'run-uuid-002', relevanceScore: 0.9, faithfulnessScore: 0.9 });

      goldenSetService.load.mockReturnValue(GOLDEN_CASES);
      ragService.execute.mockResolvedValue(RAG_RESULT);
      evalJudgeService.score.mockResolvedValue({ relevance: 0.95, faithfulness: 0.95, reasoning: 'Excellent.' });
      evalsRepository.insert.mockResolvedValueOnce(run1).mockResolvedValueOnce(run2);

      const result = await sut.execute(new RunEvalsCommand());

      expect(result.weakCases).toEqual([]);
    });
  });
});
