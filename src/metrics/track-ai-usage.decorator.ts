import { SetMetadata } from '@nestjs/common';
import type { MetricOperation } from '../schema/metric-logs.schema';
import type { AiUsageStore } from './ai-usage-context.service';

export const TRACK_AI_USAGE_KEY = Symbol('TRACK_AI_USAGE_KEY');

export const TrackAiUsage =
  (operation: MetricOperation): MethodDecorator =>
    (target, propertyKey, descriptor: PropertyDescriptor) => {
      SetMetadata<symbol, AiUsageStore>(TRACK_AI_USAGE_KEY, { operation })(target, propertyKey, descriptor);
      return descriptor;
    };
