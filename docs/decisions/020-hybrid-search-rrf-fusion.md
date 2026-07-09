# ADR-020: Hybrid Search Fuses Retrievers by Rank, Not by Score

**Status:** Accepted
**Date:** 2026-07-09

## Context

Semantic (embedding-based) search alone misses exact-term matches that have no close vector neighbor — an exact product name or acronym, for instance. A second, lexical retriever was added to run alongside the existing semantic one, and their results need to be merged into a single ranked list.

The two retrievers' relevance scores are not on comparable scales — one is a distance in embedding space, the other a lexical relevance score from an entirely different model of "relevance." Combining them by averaging or weighting the raw scores directly would require an arbitrary normalization step, and that normalization would need continual retuning as the underlying data and its distribution changes.

## Decision

Fuse the two retrievers' candidate lists using Reciprocal Rank Fusion: each candidate's fused score is derived only from *where it ranks* in each retriever's own list, not from the magnitude of either retriever's score. This is scale-free by construction, needs no normalization or tuned weight between the two retrievers, and degrades gracefully if one retriever returns nothing.

## Consequences

- No blending weight between semantic and lexical relevance to get wrong or revisit as data grows.
- A candidate surfaced by both retrievers naturally outranks one surfaced by only one, without any explicit boosting logic.
- The lexical retriever requires its own index to stay in sync with content as it changes, the same discipline already required for the embedding index.
