import { Module } from '@nestjs/common';
import { EnrichmentService } from './enrichment/enrichment.service';

@Module({
  providers: [EnrichmentService],
  exports: [EnrichmentService],
})
export class BookmarksModule {}
