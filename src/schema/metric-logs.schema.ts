import { integer, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const METRIC_OPERATIONS = ['ENRICHMENT', 'EMBEDDING', 'RAG_ASK', 'AGENT_TURN', 'EVAL_JUDGE'] as const;
export type MetricOperation = (typeof METRIC_OPERATIONS)[number];

export const metricLogsTable = pgTable('metric_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  operation: text('operation').$type<MetricOperation>().notNull(),
  model: text('model').notNull(),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  estimatedCostUsd: real('estimated_cost_usd').notNull().default(0),
  durationMs: integer('duration_ms').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MetricLogSelect = typeof metricLogsTable.$inferSelect;
export type MetricLogInsert = typeof metricLogsTable.$inferInsert;
