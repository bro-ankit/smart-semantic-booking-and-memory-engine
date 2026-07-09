import { Injectable } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AiUsageContextService } from '../../src/metrics/ai-usage-context.service';
import { AiUsageDiscoveryService } from '../../src/metrics/ai-usage-discovery.service';
import { TrackAiUsage } from '../../src/metrics/track-ai-usage.decorator';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
class DummyEnrichmentService {
  constructor(private readonly context: AiUsageContextService) { }

  @TrackAiUsage('ENRICHMENT')
  async run(): Promise<string | undefined> {
    await wait(1); // operation must survive this await, same as GeminiClient awaiting Gemini
    return this.context.getOperation();
  }

  async untaggedRun(): Promise<string | undefined> {
    return this.context.getOperation();
  }
}

describe('AiUsageDiscoveryService IT', () => {
  let module: TestingModule;
  let dummy: DummyEnrichmentService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [AiUsageContextService, AiUsageDiscoveryService, DummyEnrichmentService],
    }).compile();

    dummy = module.get(DummyEnrichmentService);
    await module.init();
  });

  afterAll(() => module.close());

  describe('Given a method decorated with @TrackAiUsage', () => {
    test('Then calling it makes the operation available via AiUsageContextService for the duration of the call', async () => {
      const seen = await dummy.run();
      expect(seen).toBe('ENRICHMENT');
    });
  });

  describe('Given a method without the decorator', () => {
    test('Then no operation is tagged and the context stays empty', async () => {
      const seen = await dummy.untaggedRun();
      expect(seen).toBeUndefined();
    });
  });

  describe('Given the decorated method has already returned', () => {
    test('Then the context does not leak into unrelated later calls', async () => {
      await dummy.run();
      const seen = await dummy.untaggedRun();
      expect(seen).toBeUndefined();
    });
  });
});
