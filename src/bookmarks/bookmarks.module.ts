import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { IngestModule } from '../ingest/ingest.module';
import { SCRAPING_QUEUE } from '../scraper/scraper.constants';
import { ScraperModule } from '../scraper/scraper.module';
import { BookmarksController } from './bookmarks.controller';
import { BOOKMARK_COMMAND_HANDLERS } from './commands';
import { CorrectionsRepository } from './corrections.repository';
import { RAGController } from './rag/rag.controller';
import { RAGService } from './rag/rag.service';
import { REVIEW_HANDLERS } from './review';
import { RerankerService } from './search/reranker.service';
import { SearchController } from './search/search.controller';
import { SearchQueryHandler } from './search/search.query-handler';
import { SearchService } from './search/search.service';

@Module({
  imports: [CqrsModule, IngestModule, ScraperModule, BullModule.registerQueue({ name: SCRAPING_QUEUE })],
  providers: [
    SearchService,
    RerankerService,
    SearchQueryHandler,
    RAGService,
    CorrectionsRepository,
    ...BOOKMARK_COMMAND_HANDLERS,
    ...REVIEW_HANDLERS,
  ],
  controllers: [BookmarksController, SearchController, RAGController],
  exports: [RAGService, SearchService],
})
export class BookmarksModule {}
