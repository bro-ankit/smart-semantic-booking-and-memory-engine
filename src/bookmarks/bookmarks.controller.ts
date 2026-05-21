import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IngestService } from './ingest/ingest.service';
import { IngestBookmarkDto } from './dto/ingest-bookmark.dto';
import type { BookmarkSelect } from '../schema/bookmarks.schema';

@ApiTags('bookmarks')
@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly ingestService: IngestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ingest raw text or a URL — enriches, embeds, and persists it' })
  ingest(@Body() dto: IngestBookmarkDto): Promise<BookmarkSelect> {
    return this.ingestService.ingest(dto);
  }
}
