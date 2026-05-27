import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  circuitBreaker,
  ExponentialBackoff,
  fullJitterGenerator,
  handleAll,
  type IPolicy,
  retry,
  SamplingBreaker,
  wrap,
} from 'cockatiel';
import type { ResiliencePolicyOptions } from './resilience-policy.types';

const DEFAULT_OPTIONS: Required<ResiliencePolicyOptions> = {
  maxAttempts: 3,
  initialDelay: 100,
  maxDelay: 2000,
  halfOpenAfter: 10_000,
  threshold: 0.5,
  minimumRps: 5,
  durationMs: 10_000,
};

@Injectable()
export class ResiliencePolicyRegistry {
  private readonly policies = new Map<string, IPolicy>();

  constructor(
    @InjectPinoLogger(ResiliencePolicyRegistry.name)
    private readonly logger: PinoLogger,
  ) {}

  getOrCreate(name: string, options: ResiliencePolicyOptions = {}): IPolicy {
    if (this.policies.has(name)) return this.policies.get(name)!;

    const opts = { ...DEFAULT_OPTIONS, ...options };

    const retryPolicy = retry(handleAll, {
      maxAttempts: opts.maxAttempts,
      backoff: new ExponentialBackoff({
        initialDelay: opts.initialDelay,
        maxDelay: opts.maxDelay,
        generator: fullJitterGenerator,
      }),
    });

    const breaker = circuitBreaker(handleAll, {
      halfOpenAfter: opts.halfOpenAfter,
      breaker: new SamplingBreaker({
        threshold: opts.threshold,
        minimumRps: opts.minimumRps,
        duration: opts.durationMs,
      }),
    });

    retryPolicy.onRetry((ctx) => {
      const msg = 'error' in ctx ? ctx.error.message : String(ctx.value);
      this.logger.warn({ attempt: ctx.attempt, error: msg }, `[${name}] retrying`);
    });

    breaker.onBreak((reason) => {
      const msg = 'error' in reason && reason.error instanceof Error ? reason.error.message : String(reason);
      this.logger.error({ reason: msg }, `[${name}] circuit OPEN`);
    });

    breaker.onReset(() => this.logger.info(`[${name}] circuit CLOSED`));
    breaker.onHalfOpen(() => this.logger.warn(`[${name}] circuit HALF-OPEN`));

    const policy = wrap(retryPolicy, breaker);
    this.policies.set(name, policy);
    return policy;
  }
}
