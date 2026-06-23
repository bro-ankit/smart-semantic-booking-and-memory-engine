# ADR-016: Human Review Gate Before Embedding

**Status:** Accepted  
**Date:** 2026-06-23

## Context

The enrichment pipeline (Gemini 2.5 Flash) produces summaries and tags that may be inaccurate, over-generalised, or missing domain context. Once a bookmark is embedded and stored in the vector store, a wrong embedding silently degrades all future retrieval. There is no mechanism to catch these errors before they propagate.

## Decision

Introduce a `REVIEW_PENDING` state between `PROCESSING` and `COMPLETED`. Enrichment runs immediately, but embedding is blocked until a human explicitly approves via `PATCH /api/v1/bookmarks/:id/review`.

The state machine becomes:

```
PENDING → PROCESSING → REVIEW_PENDING → COMPLETED
                                    ╲
                                     → FAILED (HUMAN_REJECTED)
```

The `PATCH` endpoint accepts `{ approved, editedSummary?, editedTags? }`. If edits are provided, the human-corrected values replace the AI output before embedding runs. Both the original AI output and the human-corrected version are preserved in the `corrections` table.

## Why before embedding, not after

Embeddings are derived from the summary and tags. If a human corrects the AI output post-embedding, the existing vector is stale — you'd re-embed anyway, and the old vector would sit in the store until deleted. Gating before embedding means:

1. Embedding runs exactly once, on verified content
2. The vector store only ever contains human-approved representations
3. No cleanup or re-embedding job is needed

## Corrections table as training signal

Every review — approval, edit, or rejection — is written to `corrections` with both the AI and human versions. This is the raw material for future fine-tuning: a dataset of `(AI output, human correction)` pairs grounded in real usage rather than synthetic examples.

## Consequences

- Bookmarks are not searchable until reviewed — acceptable for a personal knowledge tool; would need a bypass flag for high-volume production use
- The `corrections` table grows with every review and provides a measurable signal for model quality over time
- Rejection (`HUMAN_REJECTED`) is a first-class outcome with its own error message, visible in the state machine
