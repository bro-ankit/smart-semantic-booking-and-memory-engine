import { Module } from '@nestjs/common';
import { EnrichmentService } from './enrichment/enrichment.service';
import { IngestService } from './ingest/ingest.service';
import { BookmarksRepository } from './bookmarks.repository';
import { TodosRepository } from './todos.repository';
import { BookmarksController } from './bookmarks.controller';

@Module({
  providers: [EnrichmentService, IngestService, BookmarksRepository, TodosRepository],
  controllers: [BookmarksController],
  exports: [EnrichmentService],
})
export class BookmarksModule {}
