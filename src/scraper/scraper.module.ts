import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScraperService } from './scraper.service';
import { ScrapingProcessor } from './scraping.processor';
import { SCRAPING_QUEUE } from './scraper.constants';
import { IngestModule } from '../ingest/ingest.module';

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
