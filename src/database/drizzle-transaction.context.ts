import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { DrizzleDb } from './database.module';

export type DrizzleTx = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0];
export type DrizzleClient = DrizzleDb | DrizzleTx;

@Injectable()
export class DrizzleTransactionContext {
  private readonly asyncLocal = new AsyncLocalStorage<DrizzleTx>();

  getClient(fallback: DrizzleDb): DrizzleClient {
    return this.asyncLocal.getStore() ?? fallback;
  }

  runInContext<T>(tx: DrizzleTx, fn: () => Promise<T>): Promise<T> {
    return this.asyncLocal.run(tx, fn);
  }

  hasActiveTransaction(): boolean {
    return !!this.asyncLocal.getStore();
  }
}
