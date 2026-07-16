import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';

import { ResiliencePolicyRegistry } from './resilience-policy.registry';
import { RESILIENCE_KEY, type ResilienceMetadata } from './resilient.decorator';

@Injectable()
export class ResilienceDiscoveryService implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly registry: ResiliencePolicyRegistry,
  ) {}

  onModuleInit() {
    for (const wrapper of this.discovery.getProviders()) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== 'object') continue;

      const proto = Object.getPrototypeOf(instance);

      this.scanner.getAllMethodNames(proto).forEach((methodName) => {
        const meta = this.reflector.get<ResilienceMetadata>(RESILIENCE_KEY, proto[methodName]);
        if (!meta?.name) return;

        const original = proto[methodName] as (...args: unknown[]) => unknown;
        const policy = this.registry.getOrCreate(meta.name, meta.options);

        proto[methodName] = function (...args: unknown[]) {
          return policy.execute(() => original.apply(this, args) as Promise<unknown>);
        };
      });
    }
  }
}
