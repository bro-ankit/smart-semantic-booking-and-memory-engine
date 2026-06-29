import { EvalsRepository } from '../../src/evals/evals.repository';
import { evalRunsTable } from '../../src/schema/eval-runs.schema';
import { DrizzleTestEnvironment } from '../helpers/drizzle-test-environment';

const EVAL_RUN_SEED = {
  goldenQuestion: 'What are Kafka consumer groups?',
  expectedTopics: ['partition assignment', 'rebalancing', 'offset management'],
  expectedSourceTag: 'kafka',
  answer: 'Consumer groups allow parallel consumption by assigning partitions to each member.',
  contextChunks: ['[https://kafka.apache.org] Kafka partitions are the unit of parallelism.'],
  relevanceScore: 0.9,
  faithfulnessScore: 0.85,
  reasoning: 'Answer covers partition assignment and rebalancing but misses offset management details.',
};

describe('EvalsRepository IT', () => {
  const env = new DrizzleTestEnvironment();
  let sut: EvalsRepository;

  beforeAll(async () => {
    await env.start([EvalsRepository]);
    sut = env.module.get(EvalsRepository);
  }, 60_000);

  afterAll(() => env.stop());

  afterEach(async () => {
    await env.db.delete(evalRunsTable);
  });

  describe('Given insert', () => {
    describe('When called with a valid eval run payload', () => {
      test('Then it persists and returns the full record', async () => {
        const result = await sut.insert(EVAL_RUN_SEED);

        expect(result).toEqual({
          id: result.id,
          createdAt: result.createdAt,
          goldenQuestion: EVAL_RUN_SEED.goldenQuestion,
          expectedTopics: EVAL_RUN_SEED.expectedTopics,
          expectedSourceTag: EVAL_RUN_SEED.expectedSourceTag,
          answer: EVAL_RUN_SEED.answer,
          contextChunks: EVAL_RUN_SEED.contextChunks,
          relevanceScore: EVAL_RUN_SEED.relevanceScore,
          faithfulnessScore: EVAL_RUN_SEED.faithfulnessScore,
          reasoning: EVAL_RUN_SEED.reasoning,
        });
        expect(typeof result.id).toBe('string');
        expect(result.createdAt).toBeInstanceOf(Date);
      });
    });

    describe('When called without an optional expectedSourceTag', () => {
      test('Then it persists with null expectedSourceTag', async () => {
        const result = await sut.insert({ ...EVAL_RUN_SEED, expectedSourceTag: null });

        expect(result.expectedSourceTag).toBeNull();
        expect(result.goldenQuestion).toBe(EVAL_RUN_SEED.goldenQuestion);
      });
    });
  });
});
