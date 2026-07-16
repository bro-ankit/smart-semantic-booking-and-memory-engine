import { SetMetadata } from '@nestjs/common';

import type { ResiliencePolicyOptions } from './resilience-policy.types';

export const RESILIENCE_KEY = Symbol('RESILIENCE_KEY');

export type ResilienceMetadata = {
  name?: string;
  options?: ResiliencePolicyOptions;
};

export const Resilient =
  (metadata: ResilienceMetadata = {}): MethodDecorator =>
  (target, propertyKey, descriptor: PropertyDescriptor) => {
    const name = metadata.name ?? `${target.constructor.name}.${String(propertyKey)}`;
    SetMetadata(RESILIENCE_KEY, { ...metadata, name })(target, propertyKey, descriptor);
    return descriptor;
  };
