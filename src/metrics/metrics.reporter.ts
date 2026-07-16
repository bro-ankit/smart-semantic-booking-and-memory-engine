import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { TokenUsage } from '../ai/ai.interface';
import { DRIZZLE_DB } from '../database/database.constants';
import type { DrizzleDb } from '../database/database.module';
import { metricLogsTable, type MetricOperation } from '../schema/metric-logs.schema';

type RecordInput = {
  operation: MetricOperation;
  model: string;
  usage: TokenUsage;
  estimatedCostUsd: number;
  durationMs: number;
};

@Injectable()
export class MetricsReporter {
  constructor(
    @InjectPinoLogger(MetricsReporter.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
  ) {}

  async record(input: RecordInput): Promise<void> {
    const { operation, model, usage, estimatedCostUsd, durationMs } = input;
    this.logger.debug({ operation, totalTokens: usage.totalTokens, estimatedCostUsd }, 'Recording metric');
    try {
      await this.db.insert(metricLogsTable).values({
        operation,
        model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        estimatedCostUsd,
        durationMs,
      });
    } catch (err) {
      this.logger.error({ err, operation }, 'Failed to persist metric log');
    }
  }
}
