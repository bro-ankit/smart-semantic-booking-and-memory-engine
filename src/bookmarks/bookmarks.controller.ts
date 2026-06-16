import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiAcceptedResponse, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IngestBookmarkDto } from './dto/ingest-bookmark.dto';
import { ReviewBookmarkDto } from './dto/review-bookmark.dto';
import { BookmarkResponseDto } from './dto/bookmark-response.dto';
import { IngestBookmarkCommand } from './commands/ingest-bookmark.command';
import { ReviewBookmarkCommand } from './review/review-bookmark.command';
import { GetPendingReviewQuery } from './review/get-pending-review.query';

@ApiTags('bookmarks')
@Controller('bookmarks')
export class BookmarksController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Ingest raw text (sync, 201) or a URL (async, 202)',
    description:
      'Provide either `rawText` or `url` — never both. ' +
      'Both paths stop at REVIEW_PENDING after enrichment — call PATCH /:id/review to complete ingestion.',
  })
  @ApiCreatedResponse({ type: BookmarkResponseDto })
  @ApiAcceptedResponse({ type: BookmarkResponseDto })
  async ingest(@Body() dto: IngestBookmarkDto): Promise<BookmarkResponseDto> {
    return this.commandBus.execute(new IngestBookmarkCommand(dto));
  }

  @Get('review')
  @ApiOperation({ summary: 'List all bookmarks awaiting human review' })
  @ApiOkResponse({ type: [BookmarkResponseDto] })
  async getPendingReview(): Promise<BookmarkResponseDto[]> {
    return this.queryBus.execute(new GetPendingReviewQuery());
  }

  @Patch(':id/review')
  @ApiOperation({
    summary: 'Approve or reject a bookmark enrichment',
    description:
      'Approve to generate the embedding and complete ingestion. ' +
      'Optionally supply editedSummary/editedTags to override the AI output — the delta is logged as a correction record.',
  })
  @ApiOkResponse({ type: BookmarkResponseDto })
  async reviewBookmark(
    @Param('id') id: string,
    @Body() dto: ReviewBookmarkDto,
  ): Promise<BookmarkResponseDto> {
    return this.commandBus.execute(new ReviewBookmarkCommand(id, dto));
  }
}
