# ADR-021: Cross-Encoder Reranking on Top of RRF-Fused Candidates

**Status:** Accepted
**Date:** 2026-07-21

## Context

RRF fusion ([ADR-020](020-hybrid-search-rrf-fusion.md)) merges the vector and lexical retrievers into a single ranked list, but each underlying retriever still scores a query and a document independently of one another — a bi-encoder embeds them separately and compares vectors, and full-text search scores term overlap. Neither ever lets the query and document attend to each other jointly, so both can rank a topically-related but not-actually-responsive document above the true best answer.

A cross-encoder closes that gap: it takes the query and a candidate document as a single joint input and produces one relevance score for that specific pair. It is far more accurate at this fine-grained ranking than either retriever alone, but it's too slow to run against the full corpus per query — hence running it only as a second pass over a small candidate pool the retrievers have already narrowed down.

## Decision

After RRF fusion, hydrate the top `RERANK_POOL_K` (10) fused candidates and score each one against the query with a local, pretrained cross-encoder (`Xenova/ms-marco-MiniLM-L-6-v2`, run in-process via `@huggingface/transformers`'s ONNX runtime). Sort by that score and return the top `TOP_K` (3).

Went local instead of a hosted rerank API (Cohere/Jina/Voyage) — no API key to manage, no per-request cost, no extra network hop on the search path. Tradeoff: a one-time model download (cached under `node_modules/@huggingface/transformers/.cache`) and CPU time paid per search instead of a vendor.

## Consequences

- Every search now pays the cost of `RERANK_POOL_K` cross-encoder inferences, not just an RRF sort — a real latency cost in exchange for ranking quality, worth it at this corpus size.
- The reranker only ever sees documents the retrievers already surfaced; it cannot correct for something both retrievers missed entirely — it is strictly a re-ordering step, not a third retrieval path.
- The model cache lives inside `node_modules`, so a fresh `npm install` re-downloads it; a production deployment with cold-start sensitivity would want to pin a persistent cache directory via `env.cacheDir` instead.
- `RERANK_POOL_K` is a new knob distinct from `CANDIDATE_K` (per-retriever candidates) and `TOP_K` (final result count) — widening it trades latency for a larger pool the cross-encoder gets to pick from.
