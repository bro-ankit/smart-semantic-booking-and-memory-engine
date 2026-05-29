# ADR-015: CQRS Entry Point and IngestModule Extraction

**Status:** Accepted  
**Date:** 2026-05-29

## Context

Adding URL scraping forced a branching decision at the ingestion entry point: if the DTO carries a `url`, enqueue a BullMQ job; if it carries `rawText`, call `IngestService` directly. Placing this logic in `BookmarksController` would break the convention that controllers are thin HTTP adapters with no orchestration logic.

Separately, introducing `ScraperModule` (which needs `IngestService`) while `BookmarksModule` already imports `ScraperModule` created a potential circular dependency:

```
BookmarksModule → ScraperModule → BookmarksModule (via IngestService)
```

## Decision

### CQRS command handler owns the branching logic

The controller is reduced to a single `commandBus.execute()` call:

```typescript
@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  ingest(@Body() dto: IngestBookmarkDto): Promise<BookmarkSelect> {
    return this.commandBus.execute(new IngestBookmarkCommand(dto));
  }
}
```

`IngestBookmarkCommandHandler.execute()` owns the branch:

```typescript
async execute(command: IngestBookmarkCommand): Promise<BookmarkSelect> {
  if (command.dto.url) {
    return this.enqueueUrlScrape(command.dto.url);   // async path
  }
  return this.ingestService.ingest(command.dto);      // sync path
}
```

This follows the CQRS contract: controllers inject only buses; all orchestration lives in handlers. The handler is the correct place for "what do I do with this input?" decisions.

### IngestModule extracted to break the circular dependency

`IngestService`, `EnrichmentService`, `BookmarksRepository`, and `TodosRepository` were extracted from `BookmarksModule` into a standalone `IngestModule`:

```
src/ingest/
├── ingest.module.ts     exports IngestService, EnrichmentService, BookmarksRepository, TodosRepository
├── ingest.service.ts
└── ingest.constants.ts
```

The dependency graph after the extraction:

```
IngestModule        (no upstream deps beyond DatabaseModule/AiModule)
     ▲
     │
ScraperModule       (imports IngestModule)
     ▲
     │
BookmarksModule     (imports IngestModule + ScraperModule)
```

No cycles. Each module's import list states its actual dependencies.

### XOR DTO validation

`IngestBookmarkDto` enforces mutual exclusivity between `rawText` and `url` via a custom `@IsXorDefined` class-validator decorator. Exactly one field must be present — both or neither is a 400 validation error. This is enforced before the command handler is reached.

## Why not a service layer for the branch?

A `BookmarksService.ingest(dto)` containing the `if (url) ... else ...` branch was considered. It would have been an indirection layer with no additional logic — a "proxy service" that the `be-nestjs` skill explicitly discourages. The command handler already exists and is the canonical home for this kind of orchestration.

## Consequences

- `BookmarksController` has zero business logic and is trivially testable
- The circular dependency is structurally impossible — `IngestModule` has no knowledge of `ScraperModule` or `BookmarksModule`
- `IngestModule` can be imported independently by any future module that needs enrichment or ingestion without pulling in the full bookmarks domain
- Adding a third ingestion mode (e.g. file upload) requires only a new branch in the command handler
