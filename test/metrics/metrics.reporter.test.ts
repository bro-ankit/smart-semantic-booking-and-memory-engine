import { MetricsReporter } from '../../src/metrics/metrics.reporter';
import { metricLogsTable, type MetricOperation } from '../../src/schema/metric-logs.schema';
import { DrizzleTestEnvironment } from '../helpers/drizzle-test-environment';

const USAGE = { promptTokens: 120, completionTokens: 40, totalTokens: 160 };

describe('MetricsReporter IT', () => {
  const env = new DrizzleTestEnvironment();
  let sut: MetricsReporter;

  beforeAll(async () => {
    await env.start([MetricsReporter]);
    sut = env.module.get(MetricsReporter);
  }, 60_000);

  afterAll(() => env.stop());

  afterEach(async () => {
    await env.db.delete(metricLogsTable);
  });

  describe('Given record, When called with a valid input', () => {
    test('Then it persists a metric log row with the given values', async () => {
      await sut.record({
        operation: 'ENRICHMENT',
        model: 'gemini-2.5-flash',
        usage: USAGE,
        estimatedCostUsd: 0.0012,
        durationMs: 842,
      });

      const rows = await env.db.select().from(metricLogsTable);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        id: expect.any(String),
        operation: 'ENRICHMENT',
        model: 'gemini-2.5-flash',
        promptTokens: 120,
        completionTokens: 40,
        totalTokens: 160,
        estimatedCostUsd: 0.0012,
        durationMs: 842,
        createdAt: expect.any(Date),
      });
    });
  });

  describe('Given record, When the insert violates a database constraint', () => {
    test('Then it resolves without throwing and persists nothing', async () => {
      await expect(
        sut.record({
          operation: null as unknown as MetricOperation,
          model: 'gemini-2.5-flash',
          usage: USAGE,
          estimatedCostUsd: 0.0012,
          durationMs: 842,
        }),
      ).resolves.toBeUndefined();

      const rows = await env.db.select().from(metricLogsTable);
      expect(rows).toHaveLength(0);
    });
  });
});
