import { Module } from '@nestjs/common';
import { EnrichmentService } from './enrichment/enrichment.service';
import { IngestService } from './ingest/ingest.service';
import { SearchService } from './search/search.service';
import { BookmarksRepository } from './bookmarks.repository';
import { TodosRepository } from './todos.repository';
import { BookmarksController } from './bookmarks.controller';
import { SearchController } from './search/search.controller';

@Module({
  providers: [EnrichmentService, IngestService, SearchService, BookmarksRepository, TodosRepository],
  controllers: [BookmarksController, SearchController],
  exports: [EnrichmentService],
})
export class BookmarksModule {}
