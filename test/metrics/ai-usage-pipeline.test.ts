import { Injectable } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { AiUsageContextService } from '../../src/metrics/ai-usage-context.service';
import { AiUsageDiscoveryService } from '../../src/metrics/ai-usage-discovery.service';
import { MetricsReporter } from '../../src/metrics/metrics.reporter';
import { TrackAiUsage } from '../../src/metrics/track-ai-usage.decorator';
import { metricLogsTable } from '../../src/schema/metric-logs.schema';
import { DrizzleTestEnvironment } from '../helpers/drizzle-test-environment';

const USAGE = { promptTokens: 30, completionTokens: 10, totalTokens: 40 };

@Injectable()
class FakeAiClient {
  constructor(
    private readonly usageContext: AiUsageContextService,
    private readonly metricsReporter: MetricsReporter,
  ) {}

  async generateText(): Promise<string> {
    await Promise.resolve();
    const operation = this.usageContext.getOperation();
    if (operation) {
      await this.metricsReporter.record({
        operation,
        model: 'gemini-2.5-flash',
        usage: USAGE,
        estimatedCostUsd: 0.0004,
        durationMs: 12,
      });
    }
    return 'answer';
  }
}

@Injectable()
class FakeRagService {
  constructor(private readonly aiClient: FakeAiClient) {}

  @TrackAiUsage('RAG_ASK')
  async ask(): Promise<string> {
    return this.aiClient.generateText();
  }
}

describe('AI usage metrics pipeline IT (decorator -> ALS context -> AI client -> DB)', () => {
  const env = new DrizzleTestEnvironment();
  let ragService: FakeRagService;

  beforeAll(async () => {
    await env.start(
      [MetricsReporter, AiUsageContextService, AiUsageDiscoveryService, FakeAiClient, FakeRagService],
      [DiscoveryModule],
    );
    ragService = env.module.get(FakeRagService);
    await env.module.init();
  }, 60_000);

  afterAll(() => env.stop());

  afterEach(async () => {
    await env.db.delete(metricLogsTable);
  });

  describe('Given a decorated service method calls an AI-client-shaped dependency', () => {
    test('Then the operation tag reaches the AI client and a real row is persisted', async () => {
      const answer = await ragService.ask();

      expect(answer).toBe('answer');

      const rows = await env.db.select().from(metricLogsTable);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({
        id: expect.any(String),
        operation: 'RAG_ASK',
        model: 'gemini-2.5-flash',
        promptTokens: 30,
        completionTokens: 10,
        totalTokens: 40,
        estimatedCostUsd: 0.0004,
        durationMs: 12,
        createdAt: expect.any(Date),
      });
    });
  });

  describe('Given the AI client is called without going through a decorated method', () => {
    test('Then no operation is tagged and nothing is persisted', async () => {
      const aiClient = env.module.get(FakeAiClient);

      await aiClient.generateText();

      const rows = await env.db.select().from(metricLogsTable);
      expect(rows).toHaveLength(0);
    });
  });
});
