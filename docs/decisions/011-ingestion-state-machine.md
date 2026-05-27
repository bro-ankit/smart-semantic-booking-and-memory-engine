# ADR-011: Ingestion State Machine

**Status:** Accepted  
**Date:** 2026-05-27

## Context

The ingestion pipeline calls two external LLM APIs sequentially (enrichment, then embedding). Either call can fail mid-flight. The original implementation only inserted a row on success, which meant any failure left no trace in the database — no way to know whether an ingestion had been attempted, was in progress, or had failed.

## Decision

### Write PENDING first, then transition

A bookmark row is inserted with `status: 'PENDING'` before any LLM call is made. The pipeline then transitions through:

```
PENDING → PROCESSING → COMPLETED
                     ↘ FAILED (errorMessage set)
```

This means every ingestion attempt is visible from the moment it starts. A row stuck in `PROCESSING` signals a crashed process; a `FAILED` row carries the error message for diagnosis.

### FAILED marks the row, then rethrows

On any exception the catch block calls `updateStatus(id, 'FAILED', errorMessage)` and then re-throws. The caller still receives the error — the state update is a side effect, not a recovery.

### updateEnrichment is a dedicated method

Rather than patching `insert` to accept partial data, `updateEnrichment` handles the success-path write: sets `contentSummary`, `tags`, `embedding`, and `status: 'COMPLETED'` atomically inside the existing transaction alongside the todo inserts. This keeps the insert path simple (only `originalUrl` + `status` are required) and the enrichment update explicit.

## Consequences

- A failed ingestion is always recoverable — the row ID is known and can be retried
- `PROCESSING` rows that persist after a restart indicate a crash and can be swept by a future cleanup job
- The `errorMessage` column carries the original exception message for observability without requiring log correlation
