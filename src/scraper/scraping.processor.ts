import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SCRAPING_QUEUE, type ScrapingJobData } from './scraper.constants';
import { ScraperService } from './scraper.service';
import { IngestService } from '../ingest/ingest.service';

@Processor(SCRAPING_QUEUE)
export class ScrapingProcessor extends WorkerHost {
  constructor(
    @InjectPinoLogger(ScrapingProcessor.name) private readonly logger: PinoLogger,
    private readonly scraperService: ScraperService,
    private readonly ingestService: IngestService,
  ) {
    super();
  }

  async process(job: Job<ScrapingJobData>): Promise<void> {
    const { bookmarkId, url } = job.data;
    this.logger.info({ bookmarkId, url, attempt: job.attemptsMade + 1 }, 'Processing scraping job');

    const rawText = await this.scraperService.scrape(url);
    await this.ingestService.processRawText(bookmarkId, rawText);

    this.logger.info({ bookmarkId }, 'Scraping job complete');
  }
}
