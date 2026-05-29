# ADR-013: Async URL Ingestion via BullMQ Queue

**Status:** Accepted  
**Date:** 2026-05-29

## Context

The ingest endpoint originally accepted only `rawText`. Adding URL support introduced a new problem: scraping a URL (especially one requiring a headless browser) can take 5–30 seconds. Handling that synchronously inside the HTTP request would:

- Block the response until the scrape completes
- Timeout on any reasonably configured reverse proxy (default Nginx: 60s)
- Provide no retry mechanism if the scrape fails mid-flight
- Give the caller no immediate feedback

## Decision

URL ingestion is split into two phases:

**Phase 1 — HTTP handler (synchronous, fast):**
1. Insert a `PENDING` bookmark row with `originalUrl` set to the URL.
2. Enqueue a `scrape-url` job to BullMQ.
3. Return the `PENDING` bookmark immediately (HTTP 201).

**Phase 2 — BullMQ worker (async, durable):**
1. `ScrapingProcessor` picks up the job.
2. Calls `ScraperService.scrape(url)` to get raw text.
3. Hands the text to `IngestService.processRawText(bookmarkId, rawText)`.
4. The bookmark transitions through `PROCESSING → COMPLETED/FAILED` exactly as it does for raw-text ingestion.

### Why BullMQ + Redis, not a simple `setImmediate` or `Promise`?

| Concern | `setImmediate` | BullMQ |
|---------|---------------|--------|
| App restart loses jobs | Yes | No — jobs persist in Redis |
| Retry on transient failures | Manual | Built-in (3 attempts, exponential backoff at 3s) |
| Visibility (queued/active/failed) | None | Bull Board / Redis CLI |
| Concurrency control | Uncontrolled | Configurable worker concurrency |

### Queue configuration

```typescript
BullModule.registerQueue({
  name: SCRAPING_QUEUE,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3_000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
})
```

`removeOnComplete: 100` keeps the last 100 completed jobs visible for debugging without growing unboundedly. `removeOnFail: 200` retains failed jobs longer for diagnosis.

### Idempotency

The job is enqueued with `jobId: bookmark.id`. BullMQ deduplicates on `jobId` — re-submitting the same URL while a job is already queued or active is a no-op.

## Consequences

- The HTTP response is always fast regardless of page complexity
- Scrape failures are durably recorded as `FAILED` rows with error messages
- The BullMQ job queue outlives process restarts — no silent job loss
- The same `IngestService.processRawText` path handles the output of both raw-text and URL inputs, keeping the enrichment and embedding logic DRY
