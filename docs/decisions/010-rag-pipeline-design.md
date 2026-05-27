# ADR-010: RAG Pipeline Design

**Status:** Accepted  
**Date:** 2026-05-21

## Context

The RAG feature takes a user question, retrieves semantically relevant bookmarks, and generates a grounded answer. Two design decisions shaped the implementation.

## Decision

### `generateText` on `IAiClient` — not a new interface

Free-form text generation (`generateText`) was added to `IAiClient` alongside `generateStructured` and `generateEmbedding`. Per ADR-007: one interface, one token, until providers actually diverge.

`generateText` differs from `generateStructured` in that it uses Gemini's `systemInstruction` field (not `generationConfig`) and returns raw text — no JSON mode, no response schema.

### Context injection via system prompt

The RAG grounding uses `systemInstruction` rather than injecting context into the user message:

```
System: "Answer ONLY from this context: [bookmarks]"
User:   "How does Kafka handle ordering?"
```

This is the correct separation for instruction-following models — the system prompt sets behavioural constraints, the user message carries the query. Mixing them into a single prompt degrades grounding quality.

### Explicit no-context fallback phrase

`buildSystemPrompt()` instructs the model to respond with a specific phrase when the context doesn't answer the question:

```
"I don't have enough context in my bookmarks to answer this. Try ingesting relevant content first."
```

This is defined as `NO_CONTEXT_REPLY` in `rag.constants.ts`. If no bookmarks were found at all, the system prompt itself signals this and the model returns the fallback phrase. The caller gets an honest reply rather than a hallucinated answer.

## Consequences

- `RAGService` has zero knowledge of Gemini — it calls `IAiClient.generateText()` and `SearchService.search()`
- The context formatter (`buildSystemPrompt`) is a pure function — trivially testable without mocking
- Swapping the LLM provider requires changing only `GeminiClient` — no changes to `RAGService`
