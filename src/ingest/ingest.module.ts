import { Module } from '@nestjs/common';
import { IngestService } from './ingest.service';
import { EnrichmentService } from '../bookmarks/enrichment/enrichment.service';
import { BookmarksRepository } from '../bookmarks/bookmarks.repository';
import { TodosRepository } from '../bookmarks/todos.repository';

@Module({
  providers: [IngestService, EnrichmentService, BookmarksRepository, TodosRepository],
  exports: [IngestService, EnrichmentService, BookmarksRepository, TodosRepository],
})
export class IngestModule {}
