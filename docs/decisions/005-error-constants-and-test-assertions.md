# ADR-005: Error Constants and Test Assertion Rules

**Status:** Accepted  
**Date:** 2026-05-19

## Context

Inline error strings scattered across services are untrackable and create silent test gaps — if both the source and the test import the same constant and it has a typo, the test passes while the real message is wrong.

## Decision

### Error constants

Error messages are defined as `as const` objects co-located with the module that throws them:

```typescript
// src/ai/gemini/gemini.constants.ts
export const GEMINI_ERRORS = {
  API_CALL_FAILED: 'Gemini API call failed',
  NON_JSON_RESPONSE: 'Gemini returned non-JSON response',
} as const;

// src/bookmarks/enrichment/enrichment.constants.ts
export const ENRICHMENT_ERRORS = {
  SCHEMA_VALIDATION_FAILED: 'AI response failed schema validation',
} as const;
```

Every `throw` references a constant. No inline strings in service code.

### Test assertions

Tests assert the **raw string literal**, never the constant:

```typescript
// WRONG — if the constant has a typo, this passes silently
await AssertUtils.assertError(() => ..., ENRICHMENT_ERRORS.SCHEMA_VALIDATION_FAILED, 500);

// CORRECT — catches a bad constant value
await AssertUtils.assertError(() => ..., 'AI response failed schema validation', 500);
```

### AssertUtils.assertError

Located at `test/utils/assert.utils.ts`. Captures the thrown value once, asserts instance type and HTTP status in a single call:

```typescript
AssertUtils.assertError(action, expectedMessage, expectedStatusCode);
```

Uses `HttpException` as the base check — works for any NestJS HTTP exception (`InternalServerErrorException`, `NotFoundException`, etc.).

## Consequences

- A typo in a constant is caught by the first test run.
- Error messages are easy to grep across the codebase.
- `AssertUtils.assertError` replaces two-call patterns (`rejects.toThrow` + `rejects.toMatchObject`) with a single invocation that doesn't double-execute the action.
