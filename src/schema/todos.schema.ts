import {
  pgTable,
  uuid,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { bookmarksTable } from './bookmarks.schema';

export const todosTable = pgTable('todos', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookmarkId: uuid('bookmark_id')
    .notNull()
    .references(() => bookmarksTable.id, { onDelete: 'cascade' }),
  task: text('task').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type TodoSelect = typeof todosTable.$inferSelect;
export type TodoInsert = typeof todosTable.$inferInsert;
