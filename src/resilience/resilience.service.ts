import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { ResiliencePolicyRegistry } from './resilience-policy.registry';
import type { ResiliencePolicyOptions } from './resilience-policy.types';

@Injectable()
export class ResilienceService {
  constructor(
    @InjectPinoLogger(ResilienceService.name)
    private readonly logger: PinoLogger,
    private readonly registry: ResiliencePolicyRegistry,
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
    options?: ResiliencePolicyOptions & { input?: unknown },
  ): Promise<T> {
    const { input, ...policyOptions } = options ?? {};
    const policy = this.registry.getOrCreate(operationName, policyOptions);
    const result = await policy.execute(operation);
    this.logger.info({ input }, `[${operationName}] succeeded`);
    return result;
  }
}
