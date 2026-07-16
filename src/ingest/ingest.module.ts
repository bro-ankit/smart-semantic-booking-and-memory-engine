import { Module } from '@nestjs/common';

import { BookmarksRepository } from '../bookmarks/bookmarks.repository';
import { EnrichmentService } from '../bookmarks/enrichment/enrichment.service';
import { TodosRepository } from '../bookmarks/todos.repository';
import { IngestService } from './ingest.service';

@Module({
  providers: [IngestService, EnrichmentService, BookmarksRepository, TodosRepository],
  exports: [IngestService, EnrichmentService, BookmarksRepository, TodosRepository],
})
export class IngestModule {}
