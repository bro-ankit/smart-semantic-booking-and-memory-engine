import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { IngestBookmarkCommand } from './ingest-bookmark.command';
import { IngestService } from '../../ingest/ingest.service';
import { BookmarksRepository } from '../bookmarks.repository';
import { SCRAPING_QUEUE, type ScrapingJobData } from '../../scraper/scraper.constants';
import type { BookmarkSelect } from '../../schema/bookmarks.schema';

@CommandHandler(IngestBookmarkCommand)
export class IngestBookmarkCommandHandler implements ICommandHandler<IngestBookmarkCommand, BookmarkSelect> {
  constructor(
    @InjectPinoLogger(IngestBookmarkCommandHandler.name) private readonly logger: PinoLogger,
    private readonly ingestService: IngestService,
    private readonly bookmarksRepository: BookmarksRepository,
    @InjectQueue(SCRAPING_QUEUE) private readonly scrapingQueue: Queue<ScrapingJobData>,
  ) {}

  async execute(command: IngestBookmarkCommand): Promise<BookmarkSelect> {
    const { dto } = command;

    if (dto.url) {
      return this.enqueueUrlScrape(dto.url);
    }

    return this.ingestService.ingest(dto);
  }

  private async enqueueUrlScrape(url: string): Promise<BookmarkSelect> {
    const bookmark = await this.bookmarksRepository.insert({ originalUrl: url, status: 'PENDING' });

    await this.scrapingQueue.add(
      'scrape-url',
      { bookmarkId: bookmark.id, url },
      { jobId: bookmark.id },
    );

    this.logger.info({ bookmarkId: bookmark.id, url }, 'URL scrape job enqueued');
    return bookmark;
  }
}
