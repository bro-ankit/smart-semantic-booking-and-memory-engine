import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { AiUsageContextService } from './ai-usage-context.service';
import { AiUsageDiscoveryService } from './ai-usage-discovery.service';
import { MetricsReporter } from './metrics.reporter';

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [MetricsReporter, AiUsageContextService, AiUsageDiscoveryService],
  exports: [MetricsReporter, AiUsageContextService],
})
export class MetricsModule {}
