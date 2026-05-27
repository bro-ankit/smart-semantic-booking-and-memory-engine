import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AI_CLIENT } from '../../ai/ai.constants';
import type { IAiClient } from '../../ai/ai.interface';
import { DrizzleTransactionService } from '../../database/drizzle-transaction.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import type { BookmarkEnrichment } from '../enrichment/enrichment.zod';
import { BookmarksRepository } from '../bookmarks.repository';
import { TodosRepository } from '../todos.repository';
import type { BookmarkSelect } from '../../schema/bookmarks.schema';
import type { IngestBookmarkDto } from '../dto/ingest-bookmark.dto';

function buildSearchableString(rawText: string, enrichment: BookmarkEnrichment): string {
  return `${rawText} ${enrichment.contentSummary} ${enrichment.tags.join(' ')}`;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class IngestService {
  constructor(
    @InjectPinoLogger(IngestService.name) private readonly logger: PinoLogger,
    private readonly enrichmentService: EnrichmentService,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    private readonly transactionService: DrizzleTransactionService,
    private readonly bookmarksRepository: BookmarksRepository,
    private readonly todosRepository: TodosRepository,
  ) {}

  async ingest(dto: IngestBookmarkDto): Promise<BookmarkSelect> {
    this.logger.info('Starting ingestion pipeline');

    const bookmark = await this.bookmarksRepository.insert({
      originalUrl: dto.rawText,
      status: 'PENDING',
    });

    try {
      await this.bookmarksRepository.updateStatus(bookmark.id, 'PROCESSING');

      const enrichment = await this.enrichmentService.enrich(dto.rawText);
      const embedding = await this.aiClient.generateEmbedding(
        buildSearchableString(dto.rawText, enrichment),
      );

      const completed = await this.transactionService.execute(async () => {
        const updated = await this.bookmarksRepository.updateEnrichment(bookmark.id, {
          contentSummary: enrichment.contentSummary,
          tags: enrichment.tags,
          embedding,
          status: 'COMPLETED',
        });

        await this.todosRepository.insertMany(
          enrichment.actionItems.map((task) => ({ bookmarkId: bookmark.id, task })),
        );

        return updated;
      });

      this.logger.info({ bookmarkId: bookmark.id }, 'Ingestion complete');
      return completed;
    } catch (err) {
      const errorMessage = toErrorMessage(err);
      this.logger.error({ bookmarkId: bookmark.id, err }, 'Ingestion failed, marking FAILED');
      await this.bookmarksRepository.updateStatus(bookmark.id, 'FAILED', errorMessage);
      throw err;
    }
  }
}
