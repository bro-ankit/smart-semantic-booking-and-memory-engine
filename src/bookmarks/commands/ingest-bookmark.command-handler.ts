import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { plainToInstance } from 'class-transformer';
import { IngestBookmarkCommand } from './ingest-bookmark.command';
import { IngestService } from '../../ingest/ingest.service';
import { BookmarksRepository } from '../bookmarks.repository';
import { BookmarkResponseDto } from '../dto/bookmark-response.dto';
import { SCRAPING_QUEUE, type ScrapingJobData } from '../../scraper/scraper.constants';


@CommandHandler(IngestBookmarkCommand)
export class IngestBookmarkCommandHandler implements ICommandHandler<IngestBookmarkCommand, BookmarkResponseDto> {
  constructor(
    @InjectPinoLogger(IngestBookmarkCommandHandler.name) private readonly logger: PinoLogger,
    private readonly ingestService: IngestService,
    private readonly bookmarksRepository: BookmarksRepository,
    @InjectQueue(SCRAPING_QUEUE) private readonly scrapingQueue: Queue<ScrapingJobData>,
  ) { }

  async execute(command: IngestBookmarkCommand): Promise<BookmarkResponseDto> {
    const { dto } = command;

    if (dto.url) {
      return this.enqueueUrlScrape(dto.url);
    }

    return plainToInstance(BookmarkResponseDto, await this.ingestService.ingest(dto), { excludeExtraneousValues: true });
  }

  private async enqueueUrlScrape(url: string): Promise<BookmarkResponseDto> {
    const bookmark = await this.bookmarksRepository.insert({ originalUrl: url, status: 'PENDING' });

    await this.scrapingQueue.add(
      'scrape-url',
      { bookmarkId: bookmark.id, url },
      { jobId: bookmark.id },
    );

    this.logger.info({ bookmarkId: bookmark.id, url }, 'URL scrape job enqueued');
    return plainToInstance(BookmarkResponseDto, bookmark, { excludeExtraneousValues: true });
  }
}
