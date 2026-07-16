import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { IngestModule } from '../ingest/ingest.module';
import { SCRAPING_QUEUE } from './scraper.constants';
import { ScraperService } from './scraper.service';
import { ScrapingProcessor } from './scraping.processor';

@Module({
  imports: [
    IngestModule,
    BullModule.registerQueue({
      name: SCRAPING_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3_000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }),
  ],
  providers: [ScraperService, ScrapingProcessor],
  exports: [BullModule],
})
export class ScraperModule {}
