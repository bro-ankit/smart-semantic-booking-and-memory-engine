# ADR-003: AI Client Abstraction Layer

**Status:** Accepted  
**Date:** 2026-05-19

## Context

The enrichment pipeline calls Gemini to extract structured metadata from raw text. The embedding pipeline makes a second Gemini call to generate vector representations. Injecting `GoogleGenerativeAI` directly into each service would couple business logic to a specific provider and make both services untestable without the real SDK.

## Decision

Introduce a provider-agnostic abstraction layer under `src/ai/`:

```
src/ai/
├── ai.constants.ts          # AI_CLIENT Symbol token (public)
├── ai.interface.ts          # IAiClient + AiResponseSchema types
├── ai.module.ts             # @Global — binds GeminiClient to AI_CLIENT
└── gemini/
    ├── gemini.constants.ts  # GEMINI_CLIENT token + GEMINI_ERRORS (internal)
    ├── gemini.module.ts     # provides raw GoogleGenerativeAI instance
    └── gemini.client.ts     # GeminiClient implements IAiClient
```

`EnrichmentService` injects `AI_CLIENT: IAiClient` — it has zero Gemini imports.

`IAiClient` is intentionally narrow:
```typescript
interface IAiClient {
  generateStructured(prompt: string, schema: AiResponseSchema): Promise<unknown>;
}
```

`AiResponseSchema` is our own JSON-schema-like type. `GeminiClient` maps it to `SchemaType` enums internally via `toGeminiSchema()`. No Gemini types leak outside `src/ai/gemini/`.

## Swapping providers

Change one line in `ai.module.ts`:
```typescript
{ provide: AI_CLIENT, useExisting: GeminiClient }
// → { provide: AI_CLIENT, useExisting: ClaudeClient }
```

## Consequences

- Services are testable with a plain `jest.Mocked<IAiClient>` — no Gemini SDK in test scope.
- `AiResponseSchema` decouples schema definition from Gemini's `SchemaType` enum.
- Adding a second AI provider requires no changes to any service.
