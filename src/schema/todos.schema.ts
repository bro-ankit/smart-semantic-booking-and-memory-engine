import {
  pgTable,
  uuid,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { bookmarks } from './bookmarks.schema';

export const todos = pgTable('todos', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookmarkId: uuid('bookmark_id')
    .notNull()
    .references(() => bookmarks.id, { onDelete: 'cascade' }),
  task: text('task').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TodoSelect = typeof todos.$inferSelect;
export type TodoInsert = typeof todos.$inferInsert;
