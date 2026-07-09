import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bullmq';
import { SearchService } from './search/search.service';
import { RAGService } from './rag/rag.service';
import { BookmarksController } from './bookmarks.controller';
import { SearchController } from './search/search.controller';
import { RAGController } from './rag/rag.controller';
import { CorrectionsRepository } from './corrections.repository';
import { ScraperModule } from '../scraper/scraper.module';
import { IngestModule } from '../ingest/ingest.module';
import { SCRAPING_QUEUE } from '../scraper/scraper.constants';
import { BOOKMARK_COMMAND_HANDLERS } from './commands';
import { REVIEW_HANDLERS } from './review';
import { SearchQueryHandler } from './search/search.query-handler';

@Module({
  imports: [
    CqrsModule,
    IngestModule,
    ScraperModule,
    BullModule.registerQueue({ name: SCRAPING_QUEUE }),
  ],
  providers: [
    SearchService,
    SearchQueryHandler,
    RAGService,
    CorrectionsRepository,
    ...BOOKMARK_COMMAND_HANDLERS,
    ...REVIEW_HANDLERS,
  ],
  controllers: [BookmarksController, SearchController, RAGController],
  exports: [RAGService, SearchService],
})
export class BookmarksModule { }
