import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bullmq';
import { SearchService } from './search/search.service';
import { RAGService } from './rag/rag.service';
import { BookmarksController } from './bookmarks.controller';
import { SearchController } from './search/search.controller';
import { RAGController } from './rag/rag.controller';
import { ScraperModule } from '../scraper/scraper.module';
import { IngestModule } from '../ingest/ingest.module';
import { SCRAPING_QUEUE } from '../scraper/scraper.constants';
import { BOOKMARK_COMMAND_HANDLERS } from './commands';

@Module({
  imports: [
    CqrsModule,
    IngestModule,
    ScraperModule,
    BullModule.registerQueue({ name: SCRAPING_QUEUE }),
  ],
  providers: [
    SearchService,
    RAGService,
    ...BOOKMARK_COMMAND_HANDLERS,
  ],
  controllers: [BookmarksController, SearchController, RAGController],
})
export class BookmarksModule {}
