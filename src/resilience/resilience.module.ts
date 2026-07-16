import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { ResilienceService } from './resilience.service';
import { ResilienceDiscoveryService } from './resilience-discovery.service';
import { ResiliencePolicyRegistry } from './resilience-policy.registry';

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [ResiliencePolicyRegistry, ResilienceService, ResilienceDiscoveryService],
  exports: [ResiliencePolicyRegistry, ResilienceService],
})
export class ResilienceModule {}
