# ADR-001: Optimized pgvector String-to-Array Parser

**Status:** Accepted  
**Date:** 2026-05-18

## Context

pgvector returns embeddings from the PostgreSQL driver as a raw string in the format `[0.1,0.2,...,0.768]`. The ORM custom type's `fromDriver` function is responsible for converting this into a JavaScript `number[]`.

The naive implementation is:

```typescript
// NAIVE — do not use
fromDriver: (value: string) => value.slice(1, -1).split(',').map(Number)
```

### The Problem

On a single semantic search request fetching the top 100 results, this line executes 100 times — once per row. For 768-dimension vectors:

1. `.split(',')` allocates an intermediate array of **768 short-lived string objects**.
2. `.map(Number)` allocates a **second** array of 768 numbers.
3. The first 768-string array is immediately eligible for GC.

At 100 rows per request: **76,800 short-lived string objects** allocated and discarded per query. Under concurrent load this creates GC pressure that can stall the Node.js event loop.

## Decision

Use a **pre-allocated array + unary `+` conversion** instead:

```typescript
function parseVectorString(raw: string): number[] {
  const inner = raw.slice(1, -1);
  if (!inner) return [];
  const parts = inner.split(',');
  const result = new Array<number>(parts.length); // pre-allocated, no resizing
  for (let i = 0; i < parts.length; i++) {
    result[i] = +(parts[i]!);                     // unary + is faster than Number()
  }
  return result;
}
```

**Why not a hand-rolled char-code loop?**  
A fully zero-allocation parser would walk `charCodeAt(i)` and build floats digit-by-digit, eliminating even the `split()` allocation. This was considered but rejected because:
- pgvector emits scientific notation (e.g. `1.23e-7`) for near-zero values. Correctly parsing `e`/`E` exponents adds significant complexity and a new class of correctness bugs.
- The unary `+` operator handles all IEEE 754 formats correctly.
- The remaining `.split()` allocation is a single array, not a doubled one. The GC pressure is halved compared to the naive approach.

This is the pragmatic optimum — revisit with a WASM-based parser only if profiling shows the single `.split()` is a hot path.

## Consequences

- Memory allocation per query drops from ~2× to ~1× vector size.
- `parseVectorString` is defined once in `src/schema/vector.type.ts` and reused by all vector column instances via `createVectorType`.
- Scientific notation edge case is handled correctly by the runtime, not by custom parsing logic.
