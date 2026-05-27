# ADR-009: Semantic Search via pgvector Cosine Distance

**Status:** Accepted  
**Date:** 2026-05-21

## Context

The search feature must find the top-K bookmarks most semantically similar to a natural language query — without keyword matching.

## Decision

`GET /api/v1/search?q=...` embeds the query string via `IAiClient.generateEmbedding()`, then executes a Drizzle query using pgvector's cosine distance operator (`<=>`):

```typescript
const vector = `[${embedding.join(',')}]`;
client
  .select()
  .from(bookmarksTable)
  .where(isNotNull(bookmarksTable.embedding))
  .orderBy(sql`${bookmarksTable.embedding} <=> ${vector}::vector`)
  .limit(limit);
```

Top-K defaults to 3 (defined in `SEARCH_DEFAULTS.TOP_K`).

The response strips the raw embedding array — it's 768 floats and useless to API consumers. `SearchResultDto` exposes `id`, `originalUrl`, `contentSummary`, `tags`, `status`, `createdAt`.

## Why cosine, not L2?

Embeddings encode semantic direction. Two texts about the same concept but different lengths produce proportionally scaled vectors — cosine distance (`<=>`) is invariant to magnitude so it correctly identifies them as similar. L2 distance (`<->`) would penalize the longer document.

## Embedding column null guard

`WHERE embedding IS NOT NULL` ensures bookmarks that are still in `PENDING` or `PROCESSING` state (no embedding yet) never appear in search results.

## Consequences

- Searching "broker scale" returns results tagged with Kafka, not results containing the literal string "broker"
- The HNSW index on `embedding` (migration `0002`) makes similarity scans O(log n) rather than O(n) full-table scans
