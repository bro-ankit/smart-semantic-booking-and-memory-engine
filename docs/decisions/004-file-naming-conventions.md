# ADR-004: File Naming Conventions

**Status:** Accepted  
**Date:** 2026-05-19

## Context

Two different things in this codebase are called "schema" — Drizzle table definitions and Zod runtime validators. Using `*.schema.ts` for both creates immediate confusion about what a file contains.

## Decision

| Pattern                  | Contains                                          | Example                 |
| ------------------------ | ------------------------------------------------- | ----------------------- |
| `src/schema/*.schema.ts` | Drizzle table definitions (`pgTable`)             | `bookmarks.schema.ts`   |
| `*.zod.ts`               | Zod schemas + inferred TypeScript types           | `enrichment.zod.ts`     |
| `*.constants.ts`         | `Symbol` tokens + `as const` error/config objects | `gemini.constants.ts`   |
| `*.module.ts`            | NestJS `@Module` class                            | `ai.module.ts`          |
| `*.service.ts`           | NestJS `@Injectable` service                      | `enrichment.service.ts` |
| `*.client.ts`            | External API adapter implementing an interface    | `gemini.client.ts`      |

## Drizzle table variable naming

Drizzle table objects are named with the `Table` suffix to distinguish them from plain arrays or entity types:

```typescript
export const bookmarksTable = pgTable('bookmarks', { ... });
export const todosTable = pgTable('todos', { ... });
```

## Consequences

- Opening any file by name tells you immediately what it contains.
- `*.zod.ts` files are never confused with DB migrations or Drizzle schemas.
- New domains follow the same pattern without discussion.
