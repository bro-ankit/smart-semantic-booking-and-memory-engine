# ADR-002: Vector Column Factory Instead of Hardcoded Dimensions

**Status:** Accepted  
**Date:** 2026-05-18

## Context

The initial schema defined a module-level constant:

```typescript
// INFLEXIBLE — do not use
const EMBEDDING_DIMENSIONS = 768;
const vector = customType<...>({ dataType: () => `vector(${EMBEDDING_DIMENSIONS})` });
```

This created a single global vector type baked at 768 dimensions. Every vector column in the schema would share the same type with no ability to vary dimensions per use case.

### The Problem

Embedding model dimensions are not stable product decisions:

| Model                              | Dimensions | Use Case           |
| ---------------------------------- | ---------- | ------------------ |
| Gemini `text-embedding-004`        | 768        | Current baseline   |
| OpenAI `text-embedding-3-small`    | 1536       | Higher precision   |
| `sentence-transformers/all-MiniLM` | 384        | Edge / low-latency |
| Future models                      | Unknown    | Unknown            |

A hardcoded `768` means a dimension change requires modifying the custom type definition itself — a risky edit touching all vector columns simultaneously — and provides no way to run mixed-dimension columns in the same schema.

## Decision

Extract a **factory function** that produces a correctly-typed Drizzle custom column for any dimension value:

```typescript
export function createVectorType(dimensions: number) {
  return customType<{ data: number[]; driverData: string }>({
    dataType: () => `vector(${dimensions})`,
    toDriver: (value: number[]) => `[${value.join(',')}]`,
    fromDriver: parseVectorString,
  });
}
```

Named exports document which model each instance targets:

```typescript
export const GEMINI_EMBEDDING_DIMENSIONS = 768 as const;
export const OPENAI_EMBEDDING_DIMENSIONS = 1536 as const;

export const geminiVector = createVectorType(GEMINI_EMBEDDING_DIMENSIONS);
```

Adding support for a new model is additive — no existing column is touched:

```typescript
// Adding OpenAI support later — zero risk to existing columns
export const OPENAI_EMBEDDING_DIMENSIONS = 1536 as const;
export const openAiVector = createVectorType(OPENAI_EMBEDDING_DIMENSIONS);
```

## Consequences

- Each vector column in the schema explicitly names its model via the column type (`geminiVector`, `openAiVector`), making model provenance visible at the schema layer.
- Adding a new embedding model requires one export line and a new migration — no changes to existing columns or types.
- The dimension value is the single source of truth: `GEMINI_EMBEDDING_DIMENSIONS` is used by both the column type and can be imported by the embedding service to assert consistency at runtime.
- The migration (`vector(768)`) is still generated correctly because `dataType()` captures `dimensions` in its closure.
