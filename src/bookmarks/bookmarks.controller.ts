import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IngestService } from './ingest/ingest.service';
import { IngestBookmarkDto } from './dto/ingest-bookmark.dto';
import type { BookmarkSelect } from '../schema/bookmarks.schema';

@Controller('api/bookmarks')
export class BookmarksController {
  constructor(private readonly ingestService: IngestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  ingest(@Body() dto: IngestBookmarkDto): Promise<BookmarkSelect> {
    return this.ingestService.ingest(dto);
  }
}
