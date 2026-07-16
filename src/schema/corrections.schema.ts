import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { bookmarksTable } from './bookmarks.schema';

export const correctionsTable = pgTable('corrections', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookmarkId: uuid('bookmark_id')
    .notNull()
    .references(() => bookmarksTable.id, { onDelete: 'cascade' }),
  aiSummary: text('ai_summary').notNull(),
  humanSummary: text('human_summary'),
  aiTags: text('ai_tags').array().notNull(),
  humanTags: text('human_tags').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CorrectionSelect = typeof correctionsTable.$inferSelect;
export type CorrectionInsert = typeof correctionsTable.$inferInsert;
