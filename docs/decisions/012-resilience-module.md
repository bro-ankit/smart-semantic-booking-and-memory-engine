# ADR-012: Resilience Module — Retry and Circuit Breaker

**Status:** Accepted  
**Date:** 2026-05-27

## Context

LLM API calls (enrichment and embedding generation) are network-dependent and fail transiently under rate limits or timeouts. A simple retry loop was initially written in `src/common/retry.ts`, but it had no circuit breaker, no structured logging on attempts, and no reuse path across other services.

## Decision

### Mirror the pks-commons resilience module locally

The resilience module from `pks-commons` (cockatiel-based: retry + sampling circuit breaker) was copied into `src/resilience/` rather than importing the package. Reasons:

- The commons package depends on `@pks/common-logger`, which is not used in this service — pulling it in would have added an unrelated dependency tree
- The module is small and self-contained (5 files); copying it avoids version coupling
- The only adaptation needed was swapping `CommonLoggerService` for `nestjs-pino`'s `PinoLogger`

### `@Resilient()` decorator, not manual `ResilienceService.execute()` calls

The decorator approach was chosen over wrapping calls manually at each callsite:

```typescript
// ✅ decorator — policy is applied once, at the method boundary
@Resilient()
async enrich(text: string): Promise<BookmarkEnrichment> { ... }

// ✗ manual — every caller must remember to wrap
const result = await resilienceService.execute(() => this.enrich(text), 'enrich');
```

`ResilienceDiscoveryService` scans providers on `onModuleInit` and replaces decorated methods in-place. Callers (`IngestService`) are unaware of retries — they call `enrichmentService.enrich()` directly and resilience is applied transparently.

### Policy defaults

| Option          | Value                 | Rationale                                               |
| --------------- | --------------------- | ------------------------------------------------------- |
| `maxAttempts`   | 3                     | Two retries before propagating the error                |
| `initialDelay`  | 100ms                 | Low enough to not noticeably stall a request            |
| `maxDelay`      | 2000ms                | Caps backoff; avoids long hangs under sustained failure |
| `generator`     | `fullJitterGenerator` | Spreads retry storms across concurrent requests         |
| `threshold`     | 0.5                   | Circuit opens when >50% of sampled requests fail        |
| `minimumRps`    | 5                     | Prevents tripping on low-traffic noise                  |
| `halfOpenAfter` | 10s                   | Recovery probe window                                   |

### ResilienceModule is global

`@Global()` means no module needs to explicitly import it — any provider can use `@Resilient()` or inject `ResilienceService` without adding it to their module's imports.

## Consequences

- Retry and circuit-breaker behaviour is centrally defined and consistently applied
- Adding resilience to a new LLM call requires only one line (`@Resilient()`) with no changes to callers
- The circuit breaker prevents cascading failures from a degraded Gemini API from exhausting connection pools
- Policy options can be tuned per operation name without touching call sites
