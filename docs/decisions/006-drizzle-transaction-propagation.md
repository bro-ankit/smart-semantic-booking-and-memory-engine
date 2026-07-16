# ADR-006: Drizzle Transaction Propagation via AsyncLocalStorage

**Status:** Accepted  
**Date:** 2026-05-20

## Context

The ingestion pipeline must insert a bookmark and its todos atomically. The naive solution inlines the transaction inside `BookmarksRepository`, which breaks two rules:

- A repository should only own its own table — `BookmarksRepository` should not reach into `todosTable`
- Transaction management is an infrastructure concern, not a repository concern

## Decision

Introduce `DrizzleTransactionContext` (backed by `AsyncLocalStorage`) and `DrizzleTransactionService`, both exported globally from `DatabaseModule`.

```
src/database/
├── drizzle-transaction.context.ts   AsyncLocalStorage<DrizzleTx>
└── drizzle-transaction.service.ts   execute<T>(fn: () => Promise<T>): Promise<T>
```

Repositories never open transactions. They call:

```typescript
const client = this.txContext.getClient(this.db);
await client.insert(table).values(data).returning();
```

`getClient()` returns the ambient transaction if one is active, or the raw `DrizzleDb` otherwise.

The service layer opens the boundary:

```typescript
return this.transactionService.execute(async () => {
  const bookmark = await this.bookmarksRepository.insert(...);
  await this.todosRepository.insertMany(...);
  return bookmark;
});
```

Propagation is automatic: if `execute()` is called inside an already-active transaction, it reuses it instead of nesting.

## Consequences

- Each repository is atomic at the single-table level and testable in isolation
- The service layer owns transactional boundaries — no repository knows about others
- Swapping Drizzle for another ORM requires changing only `DrizzleTransactionContext` — all repository call sites stay identical
