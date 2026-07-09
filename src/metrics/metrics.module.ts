import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { MetricsReporter } from './metrics.reporter';
import { AiUsageContextService } from './ai-usage-context.service';
import { AiUsageDiscoveryService } from './ai-usage-discovery.service';

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [MetricsReporter, AiUsageContextService, AiUsageDiscoveryService],
  exports: [MetricsReporter, AiUsageContextService],
})
export class MetricsModule {}
