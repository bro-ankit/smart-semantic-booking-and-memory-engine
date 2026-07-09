# ADR-019: Metrics Recording Stays In-Process, Not Event-Driven

**Status:** Accepted
**Date:** 2026-07-09

## Context

Every AI call now produces a usage/cost metric that needs to be persisted. Given a message broker is already present in this system for other work, routing metric recording through it — publish an event, let a separate consumer persist it — was considered, on the theory that decoupling the write from the AI call would be architecturally cleaner.

## Decision

Metric recording stays a direct, in-process call from the AI client to the persistence layer, with the write itself resilient to failure independent of whether it succeeds or not.

A pure publish/subscribe broker was rejected specifically for this: without durability or replay, it doesn't decouple anything meaningfully — it just relocates the same "this can silently fail" risk from one hop to a different hop, while adding a second component (a broker plus a subscriber) that has to be deployed and monitored to solve a problem that a broker isn't actually solving.

An event-driven layer would earn its cost under two specific conditions this system doesn't have yet: more than one independent consumer needs to react to the same "usage recorded" fact, or metrics need to survive the recording process crashing before the write lands — which needs durable, replayable delivery, not simple pub/sub.

## Consequences

- One path, one place responsible for metric persistence, with no distributed failure surface to reason about.
- Adding a second consumer of usage data later is a deliberate, visible change — introducing eventing at that point — rather than infrastructure carried from day one on the chance it might be needed.
