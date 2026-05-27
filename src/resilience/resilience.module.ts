import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ResiliencePolicyRegistry } from './resilience-policy.registry';
import { ResilienceService } from './resilience.service';
import { ResilienceDiscoveryService } from './resilience-discovery.service';

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [ResiliencePolicyRegistry, ResilienceService, ResilienceDiscoveryService],
  exports: [ResiliencePolicyRegistry, ResilienceService],
})
export class ResilienceModule {}
