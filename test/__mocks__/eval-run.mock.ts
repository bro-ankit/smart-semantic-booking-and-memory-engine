import type { EvalRunSelect } from '../../src/schema/eval-runs.schema';

export const mockEvalRunSelect = (overrides: Partial<EvalRunSelect> = {}): EvalRunSelect => ({
  id: 'run-uuid-001',
  goldenQuestion: 'What are Kafka consumer groups?',
  expectedTopics: ['partition assignment', 'rebalancing'],
  expectedSourceTag: 'kafka',
  answer: 'Consumer groups enable parallel consumption.',
  contextChunks: ['[https://kafka.apache.org] Kafka partitions.'],
  relevanceScore: 0.9,
  faithfulnessScore: 0.85,
  reasoning: 'Good coverage of expected topics.',
  createdAt: new Date('2026-05-29T00:00:00Z'),
  ...overrides,
});
