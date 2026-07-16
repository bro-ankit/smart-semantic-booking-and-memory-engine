# ADR-017: LLM-as-Judge Eval Harness Over Keyword Matching

**Status:** Accepted  
**Date:** 2026-06-23

## Context

RAG system quality degrades silently. A prompt change, model upgrade, or retrieval tweak can improve answers for some questions while breaking others. Without a repeatable measurement, there is no way to prove a change helped or to catch regressions before they reach production.

The two obvious approaches are keyword/string matching and LLM-as-judge scoring.

## Decision

Use a second Gemini 2.5 Flash call as the judge. The judge receives the question, the retrieved context chunks, the RAG answer, and a list of expected topics, then returns `{ relevance: float, faithfulness: float, reasoning: string }` as structured JSON.

The golden dataset (`evals/golden-set.json`) is intentionally empty at project init — questions are added only after real bookmarks have been ingested. A golden case that isn't grounded in actual stored content produces a misleading score.

The eval runs on demand via `POST /api/v1/evals/run` and persists every score to the `eval_runs` table for historical comparison.

## Why not keyword matching

Keyword matching is deterministic and free, but it has no understanding of semantics. "Partition reassignment" and "rebalancing of topic partitions" score differently despite meaning the same thing. It also cannot distinguish between a relevant-but-hallucinated answer and a relevant-and-grounded answer — the two failure modes that actually matter for a RAG system.

The two scores measure orthogonal concerns:

- **relevance** — does the answer address the question?
- **faithfulness** — is every claim grounded in the retrieved context, or is the model inventing facts?

A keyword matcher cannot produce this distinction.

## Why two separate scores

A single "quality" score would mask the failure mode. An answer can score high on relevance (directly addresses the question) while scoring low on faithfulness (hallucinated supporting facts). Treating these separately makes the regression watchlist (`weakCases`, threshold `< 0.7`) actionable — a faithfulness drop tells you to fix the system prompt or retrieval; a relevance drop tells you to fix the embedding or golden case coverage.

## Consequences

- Each eval run costs one Gemini call per golden case plus one judge call per case — O(2n) API calls
- The judge is non-deterministic; scores can vary slightly across runs on the same content. Treat averages as trends, not exact measurements
- `eval_runs` table grows unbounded; add a retention policy if runs become frequent
- The empty golden set is a feature, not a bug — it forces the engineer to ground evals in real ingested content rather than hypothetical questions
