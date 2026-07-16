import { doublePrecision, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const evalRunsTable = pgTable('eval_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  goldenQuestion: text('golden_question').notNull(),
  expectedTopics: text('expected_topics').array().notNull(),
  expectedSourceTag: text('expected_source_tag'),
  answer: text('answer').notNull(),
  contextChunks: text('context_chunks').array().notNull(),
  relevanceScore: doublePrecision('relevance_score').notNull(),
  faithfulnessScore: doublePrecision('faithfulness_score').notNull(),
  reasoning: text('reasoning').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type EvalRunSelect = typeof evalRunsTable.$inferSelect;
export type EvalRunInsert = typeof evalRunsTable.$inferInsert;
