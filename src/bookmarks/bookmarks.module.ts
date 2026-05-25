import { Module } from '@nestjs/common';
import { EnrichmentService } from './enrichment/enrichment.service';
import { IngestService } from './ingest/ingest.service';
import { SearchService } from './search/search.service';
import { RAGService } from './rag/rag.service';
import { BookmarksRepository } from './bookmarks.repository';
import { TodosRepository } from './todos.repository';
import { BookmarksController } from './bookmarks.controller';
import { SearchController } from './search/search.controller';
import { RAGController } from './rag/rag.controller';

@Module({
  providers: [EnrichmentService, IngestService, SearchService, RAGService, BookmarksRepository, TodosRepository],
  controllers: [BookmarksController, SearchController, RAGController],
  exports: [EnrichmentService],
})
export class BookmarksModule {}
