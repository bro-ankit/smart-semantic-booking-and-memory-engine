import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiAcceptedResponse, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IngestBookmarkDto } from './dto/ingest-bookmark.dto';
import { IngestBookmarkCommand } from './commands/ingest-bookmark.command';
import type { BookmarkSelect } from '../schema/bookmarks.schema';

@ApiTags('bookmarks')
@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({
    summary: 'Ingest raw text (sync, 201) or a URL (async, 202)',
    description:
      'Provide either `rawText` or `url` — never both. ' +
      'Raw text is processed synchronously and returns the completed bookmark. ' +
      'A URL is queued for background scraping and returns a PENDING bookmark immediately.',
  })
  @ApiCreatedResponse({ description: 'rawText ingested — bookmark fully enriched and embedded' })
  @ApiAcceptedResponse({ description: 'URL accepted — scraping queued, bookmark status is PENDING' })
  ingest(@Body() dto: IngestBookmarkDto): Promise<BookmarkSelect> {
    return this.commandBus.execute(new IngestBookmarkCommand(dto));
  }
}
