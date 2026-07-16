import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DRIZZLE_DB } from '../database/database.constants';
import type { DrizzleDb } from '../database/database.module';
import { DrizzleTransactionContext } from '../database/drizzle-transaction.context';
import { type EvalRunInsert, type EvalRunSelect, evalRunsTable } from '../schema/eval-runs.schema';

@Injectable()
export class EvalsRepository {
  constructor(
    @InjectPinoLogger(EvalsRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) {}

  async insert(data: EvalRunInsert): Promise<EvalRunSelect> {
    this.logger.debug({ goldenQuestion: data.goldenQuestion }, 'Persisting eval run');
    const client = this.txContext.getClient(this.db);
    const [result] = await client.insert(evalRunsTable).values(data).returning();
    return result;
  }
}
