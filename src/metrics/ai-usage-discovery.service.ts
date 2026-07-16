import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';

import { AiUsageContextService, type AiUsageStore } from './ai-usage-context.service';
import { TRACK_AI_USAGE_KEY } from './track-ai-usage.decorator';

@Injectable()
export class AiUsageDiscoveryService implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly context: AiUsageContextService,
  ) {}

  onModuleInit() {
    for (const wrapper of this.discovery.getProviders()) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== 'object') continue;

      const proto = Object.getPrototypeOf(instance);

      this.scanner.getAllMethodNames(proto).forEach((methodName) => {
        const meta = this.reflector.get<AiUsageStore>(TRACK_AI_USAGE_KEY, proto[methodName]);
        if (!meta) return;

        const original = proto[methodName] as (...args: unknown[]) => unknown;
        const context = this.context;

        proto[methodName] = function (...args: unknown[]) {
          return context.run(meta, () => original.apply(this, args));
        };
      });
    }
  }
}
