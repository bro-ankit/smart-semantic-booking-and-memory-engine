import { Inject, Injectable } from '@nestjs/common';

import { DRIZZLE_DB } from './database.constants';
import type { DrizzleDb } from './database.module';
import { DrizzleTransactionContext, type DrizzleTx } from './drizzle-transaction.context';

@Injectable()
export class DrizzleTransactionService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.txContext.hasActiveTransaction()) {
      return fn();
    }

    return this.db.transaction((tx) => this.txContext.runInContext(tx as DrizzleTx, fn));
  }
}
