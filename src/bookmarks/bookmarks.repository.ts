import { Inject, Injectable } from '@nestjs/common';
import { sql, isNotNull, and, eq } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE_DB } from '../database/database.constants';
import { DrizzleTransactionContext } from '../database/drizzle-transaction.context';
import type { DrizzleDb } from '../database/database.module';
import { bookmarksTable, type BookmarkInsert, type BookmarkSelect, type IngestionStatus } from '../schema/bookmarks.schema';

@Injectable()
export class BookmarksRepository {
  constructor(
    @InjectPinoLogger(BookmarksRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) { }

  async insert(data: BookmarkInsert): Promise<BookmarkSelect> {
    this.logger.debug('Inserting bookmark');
    const client = this.txContext.getClient(this.db);
    const [result] = await client.insert(bookmarksTable).values(data).returning();
    return result!;
  }

  async updateStatus(id: string, status: IngestionStatus, errorMessage?: string): Promise<void> {
    this.logger.debug({ id, status }, 'Updating bookmark status');
    const client = this.txContext.getClient(this.db);
    await client
      .update(bookmarksTable)
      .set({ status, ...(errorMessage !== undefined && { errorMessage }) })
      .where(eq(bookmarksTable.id, id));
  }

  async updateEnrichment(
    id: string,
    data: { contentSummary: string; tags: string[]; embedding: number[]; status: IngestionStatus },
  ): Promise<BookmarkSelect> {
    this.logger.debug({ id }, 'Updating bookmark with enrichment data');
    const client = this.txContext.getClient(this.db);
    const [result] = await client
      .update(bookmarksTable)
      .set(data)
      .where(eq(bookmarksTable.id, id))
      .returning();
    return result!;
  }

  async findSimilar(embedding: number[], limit: number, maxDistance: number): Promise<BookmarkSelect[]> {
    this.logger.debug({ limit, maxDistance }, 'Finding similar bookmarks by embedding');
    const client = this.txContext.getClient(this.db);
    const vector = `[${embedding.join(',')}]`;
    const distanceExpr = sql<number>`${bookmarksTable.embedding} <=> ${vector}::vector`;
    const rows = await client
      .select({ bookmark: bookmarksTable, distance: distanceExpr })
      .from(bookmarksTable)
      .where(and(
        isNotNull(bookmarksTable.embedding),
        sql`${bookmarksTable.embedding} <=> ${vector}::vector <= ${maxDistance}`,
      ))
      .orderBy(distanceExpr)
      .limit(limit);

    this.logger.info(
      { scores: rows.map((r) => ({ id: r.bookmark.id, distance: r.distance })) },
      'Similarity scores',
    );
    return rows.map((r) => r.bookmark);
  }
}
