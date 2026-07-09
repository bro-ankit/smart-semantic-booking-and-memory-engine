# ADR-018: Ambient Context for Cross-Cutting AI Usage Attribution

**Status:** Accepted
**Date:** 2026-07-09

## Context

Every AI call needs to be attributed to a logical operation (enrichment, RAG answering, eval judging, agent reasoning) so cost and token usage can be measured per operation. The AI client itself is a shared, low-level dependency reused across all of these operations — it has no notion of which higher-level workflow is currently invoking it, and it shouldn't need one to do its actual job of talking to the model provider.

The first approach considered was to make each AI-client call return its usage data to the caller, and have every calling service respond to it. This works, but it means every workflow — regardless of whether it cares about metrics — has to carry that responsibility, and the AI client's contract stops being "generate content" and becomes "generate content, plus report on yourself." That's the wrong layer to own it: usage attribution is orthogonal to what any individual workflow is trying to do, and duplicating that responsibility across every caller is exactly the kind of cross-cutting concern that shouldn't leak into business logic.

## Decision

Attribution flows as ambient, request-scoped context rather than being threaded explicitly through function signatures or return values: a workflow entry point tags itself with its operation once, and anything invoked underneath it — no matter how many layers deep — can read that tag without it being passed along as data. The AI client reads the tag when it already has usage data in hand and reports against it directly.

This mirrors a pattern already established in this codebase for transaction scoping: most call sites get an ambient scope "for free" by being invoked from an already-tagged entry point; a small number of call sites where that doesn't reach cleanly re-establish the scope manually, using the same underlying mechanism rather than inventing a second one. A boundary case turned up where the straightforward version of this doesn't reach on its own (work that resumes incrementally over time rather than completing in one pass) — the fix there was to keep using the same ambient-context mechanism, re-entered manually at the one place it doesn't propagate through automatically, rather than switching that case to a different propagation strategy (e.g. passing the tag explicitly as data). Consistency of *mechanism* was judged more valuable than consistency of *syntax* at every call site.

## Consequences

- Any workflow can be attributed to a usage operation without its own code ever mentioning usage, cost, or a metrics dependency.
- The AI client's contract stays limited to what it actually does; bookkeeping is invisible to callers.
- The mechanism is only as reliable as the tagging at each entry point — an entry point that fails to establish the ambient scope (or a boundary case handled incorrectly) causes a silent gap in attribution rather than a hard failure. Acceptable while a missed metric is low-cost; worth reconsidering before reusing this pattern somewhere a silent gap would matter more.
