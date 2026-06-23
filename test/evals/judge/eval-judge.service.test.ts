import { HttpStatus } from '@nestjs/common';
import { TestBed } from '@automock/jest';
import { EvalJudgeService } from '../../../src/evals/judge/eval-judge.service';
import { AI_CLIENT } from '../../../src/ai/ai.constants';
import type { IAiClient } from '../../../src/ai/ai.interface';
import { AssertUtils } from '../../utils/assert.utils';
import type { EvalJudgeInput } from '../../../src/evals/evals.types';

const INPUT: EvalJudgeInput = {
  question: 'What are Kafka consumer groups?',
  answer: 'Consumer groups allow parallel consumption by assigning partitions to consumers.',
  expectedTopics: ['partition assignment', 'rebalancing', 'offset management'],
  contextChunks: ['[https://kafka.apache.org] Kafka uses partitions to distribute load across consumer group members.'],
};

const JUDGE_RESULT = {
  relevance: 0.9,
  faithfulness: 0.85,
  reasoning: 'Answer addresses partition assignment but omits offset management.',
};

describe('EvalJudgeService Unit Test', () => {
  let sut: EvalJudgeService;
  let aiClient: jest.Mocked<IAiClient>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(EvalJudgeService).compile();
    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given score, When called', () => {
    describe('And Gemini returns a valid judge result', () => {
      test('Then it returns the parsed relevance, faithfulness, and reasoning', async () => {
        aiClient.generateStructured.mockResolvedValue(JUDGE_RESULT);

        const result = await sut.score(INPUT);

        expect(result).toEqual({
          relevance: 0.9,
          faithfulness: 0.85,
          reasoning: 'Answer addresses partition assignment but omits offset management.',
        });

        const [promptArg, schemaArg] = aiClient.generateStructured.mock.calls[0]!;
        expect(promptArg).toContain(INPUT.question);
        expect(promptArg).toContain(INPUT.answer);
        expect(promptArg).toContain('partition assignment');
        expect(promptArg).toContain(INPUT.contextChunks[0]);
        expect(schemaArg.type).toBe('object');
        expect(schemaArg.required).toEqual(['relevance', 'faithfulness', 'reasoning']);
      });
    });

    describe('And Gemini returns scores outside 0–1 range', () => {
      test('Then it throws 500 with "Eval judge returned an invalid scoring schema"', async () => {
        aiClient.generateStructured.mockResolvedValue({ relevance: 1.5, faithfulness: -0.1, reasoning: 'bad' });

        await AssertUtils.assertError(
          () => sut.score(INPUT),
          'Eval judge returned an invalid scoring schema',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    });

    describe('And Gemini returns a missing field', () => {
      test('Then it throws 500 with "Eval judge returned an invalid scoring schema"', async () => {
        aiClient.generateStructured.mockResolvedValue({ relevance: 0.9 });

        await AssertUtils.assertError(
          () => sut.score(INPUT),
          'Eval judge returned an invalid scoring schema',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    });

    describe('And context chunks are empty', () => {
      test('Then it includes the no-context placeholder in the prompt', async () => {
        aiClient.generateStructured.mockResolvedValue(JUDGE_RESULT);

        await sut.score({ ...INPUT, contextChunks: [] });

        const [promptArg] = aiClient.generateStructured.mock.calls[0]!;
        expect(promptArg).toContain('(no context retrieved from vector store)');
      });
    });
  });
});
