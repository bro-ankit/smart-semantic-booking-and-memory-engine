import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { AI_CLIENT } from '../ai/ai.constants';
import type { IAiClient } from '../ai/ai.interface';
import { BookmarksRepository } from '../bookmarks/bookmarks.repository';
import type { IngestBookmarkDto } from '../bookmarks/dto/ingest-bookmark.dto';
import { EnrichmentService } from '../bookmarks/enrichment/enrichment.service';
import { TodosRepository } from '../bookmarks/todos.repository';
import { DrizzleTransactionService } from '../database/drizzle-transaction.service';
import type { BookmarkSelect } from '../schema/bookmarks.schema';

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
      originalUrl: dto.rawText!,
      status: 'PENDING',
    });

    return this.processRawText(bookmark.id, dto.rawText!);
  }

  async processRawText(bookmarkId: string, rawText: string): Promise<BookmarkSelect> {
    try {
      await this.bookmarksRepository.updateStatus(bookmarkId, 'PROCESSING');

      const enrichment = await this.enrichmentService.enrich(rawText);
      const paused = await this.bookmarksRepository.updateWithAiEnrichment(bookmarkId, {
        aiContentSummary: enrichment.contentSummary,
        aiTags: enrichment.tags,
        aiActionItems: enrichment.actionItems,
      });

      this.logger.info({ bookmarkId }, 'Enrichment complete — awaiting human review');
      return paused;
    } catch (err) {
      const errorMessage = toErrorMessage(err);
      this.logger.error({ bookmarkId, err }, 'Ingestion failed, marking FAILED');
      await this.bookmarksRepository.updateStatus(bookmarkId, 'FAILED', errorMessage);
      throw err;
    }
  }

  async embedAndComplete(
    bookmarkId: string,
    finalSummary: string,
    finalTags: string[],
    actionItems: string[],
  ): Promise<BookmarkSelect> {
    const embedding = await this.aiClient.generateEmbedding(`${finalSummary} ${finalTags.join(' ')}`);

    return this.transactionService.execute(async () => {
      const updated = await this.bookmarksRepository.updateEnrichment(bookmarkId, {
        contentSummary: finalSummary,
        tags: finalTags,
        embedding,
        status: 'COMPLETED',
      });

      await this.todosRepository.insertMany(actionItems.map((task) => ({ bookmarkId, task })));

      return updated;
    });
  }
}
