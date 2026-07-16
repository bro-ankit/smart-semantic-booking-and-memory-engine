import { Inject, Injectable } from '@nestjs/common';
import { and, arrayContains, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DRIZZLE_DB } from '../database/database.constants';
import type { DrizzleDb } from '../database/database.module';
import { DrizzleTransactionContext } from '../database/drizzle-transaction.context';
import {
  type BookmarkInsert,
  type BookmarkSelect,
  bookmarksTable,
  type IngestionStatus,
} from '../schema/bookmarks.schema';

@Injectable()
export class BookmarksRepository {
  constructor(
    @InjectPinoLogger(BookmarksRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) {}

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
    const searchableText = `${data.contentSummary} ${data.tags.join(' ')}`;
    const [result] = await client
      .update(bookmarksTable)
      .set({ ...data, tsvContent: sql`to_tsvector('english', ${searchableText})` })
      .where(eq(bookmarksTable.id, id))
      .returning();
    return result!;
  }

  async findById(id: string): Promise<BookmarkSelect | undefined> {
    this.logger.debug({ id }, 'Finding bookmark by id');
    const client = this.txContext.getClient(this.db);
    const [result] = await client.select().from(bookmarksTable).where(eq(bookmarksTable.id, id)).limit(1);
    return result;
  }

  async findByStatus(status: IngestionStatus): Promise<BookmarkSelect[]> {
    this.logger.debug({ status }, 'Finding bookmarks by status');
    const client = this.txContext.getClient(this.db);
    return client.select().from(bookmarksTable).where(eq(bookmarksTable.status, status));
  }

  async updateWithAiEnrichment(
    id: string,
    data: { aiContentSummary: string; aiTags: string[]; aiActionItems: string[] },
  ): Promise<BookmarkSelect> {
    this.logger.debug({ id }, 'Saving AI enrichment, transitioning to REVIEW_PENDING');
    const client = this.txContext.getClient(this.db);
    const [result] = await client
      .update(bookmarksTable)
      .set({ ...data, status: 'REVIEW_PENDING' })
      .where(eq(bookmarksTable.id, id))
      .returning();
    return result;
  }

  async findSimilar(embedding: number[], limit: number, maxDistance: number): Promise<BookmarkSelect[]> {
    this.logger.debug({ limit, maxDistance }, 'Finding similar bookmarks by embedding');
    const client = this.txContext.getClient(this.db);
    const vector = `[${embedding.join(',')}]`;
    const distanceExpr = sql<number>`${bookmarksTable.embedding} <=> ${vector}::vector`;
    const rows = await client
      .select({ bookmark: bookmarksTable, distance: distanceExpr })
      .from(bookmarksTable)
      .where(
        and(
          isNotNull(bookmarksTable.embedding),
          sql`${bookmarksTable.embedding} <=> ${vector}::vector <= ${maxDistance}`,
        ),
      )
      .orderBy(distanceExpr)
      .limit(limit);

    this.logger.info({ scores: rows.map((r) => ({ id: r.bookmark.id, distance: r.distance })) }, 'Similarity scores');
    return rows.map((r) => r.bookmark);
  }

  async findByTag(tag: string): Promise<BookmarkSelect[]> {
    const normalizedTag = tag.toLowerCase();
    this.logger.debug({ tag: normalizedTag }, 'Finding bookmarks by tag');
    const client = this.txContext.getClient(this.db);
    return client
      .select()
      .from(bookmarksTable)
      .where(and(eq(bookmarksTable.status, 'COMPLETED'), arrayContains(bookmarksTable.tags, [normalizedTag])));
  }

  async findSimilarIds(embedding: number[], limit: number): Promise<string[]> {
    const client = this.txContext.getClient(this.db);
    const vector = `[${embedding.join(',')}]`;
    const distanceExpr = sql<number>`${bookmarksTable.embedding} <=> ${vector}::vector`;
    const rows = await client
      .select({ id: bookmarksTable.id })
      .from(bookmarksTable)
      .where(and(isNotNull(bookmarksTable.embedding), eq(bookmarksTable.status, 'COMPLETED')))
      .orderBy(distanceExpr)
      .limit(limit);
    return rows.map((r) => r.id);
  }

  async findByLexical(query: string, limit: number): Promise<string[]> {
    const client = this.txContext.getClient(this.db);
    const rows = await client
      .select({ id: bookmarksTable.id })
      .from(bookmarksTable)
      .where(
        and(
          isNotNull(bookmarksTable.tsvContent),
          eq(bookmarksTable.status, 'COMPLETED'),
          sql`${bookmarksTable.tsvContent} @@ plainto_tsquery('english', ${query})`,
        ),
      )
      .orderBy(sql`ts_rank(${bookmarksTable.tsvContent}, plainto_tsquery('english', ${query})) DESC`)
      .limit(limit);
    return rows.map((r) => r.id);
  }

  async findByIds(ids: string[]): Promise<BookmarkSelect[]> {
    if (ids.length === 0) return [];
    const client = this.txContext.getClient(this.db);
    return client.select().from(bookmarksTable).where(inArray(bookmarksTable.id, ids));
  }
}
