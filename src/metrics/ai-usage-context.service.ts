import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

import type { MetricOperation } from '../schema/metric-logs.schema';

export type AiUsageStore = { operation: MetricOperation };

@Injectable()
export class AiUsageContextService {
  private readonly als = new AsyncLocalStorage<AiUsageStore>();

  // Re-enters the ALS context around each individual step of `source`, since a
  // context established around the call that creates an async iterable does not
  // survive into the later steps a consumer takes to iterate it.
  async *runIterable<T>(store: AiUsageStore, source: AsyncIterable<T>): AsyncIterable<T> {
    const iterator = source[Symbol.asyncIterator]();
    while (true) {
      const { value, done } = await this.run(store, () => iterator.next());
      if (done) return;
      yield value;
    }
  }

  run<T>(store: AiUsageStore, fn: () => T): T {
    return this.als.run(store, fn);
  }

  getOperation(): MetricOperation | undefined {
    return this.als.getStore()?.operation;
  }
}
