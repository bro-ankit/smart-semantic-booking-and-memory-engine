import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { getGeminiVector } from './vector.type';

export const INGESTION_STATUSES = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
] as const;

export type IngestionStatus = (typeof INGESTION_STATUSES)[number];

export const bookmarks = pgTable('bookmarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  originalUrl: text('original_url').notNull(),
  contentSummary: text('content_summary').notNull().default(''),
  tags: text('tags').array().notNull().default([]),
  embedding: getGeminiVector('embedding'),
  status: text('status')
    .$type<IngestionStatus>()
    .notNull()
    .default('PENDING'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BookmarkSelect = typeof bookmarks.$inferSelect;
export type BookmarkInsert = typeof bookmarks.$inferInsert;
