import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { plainToInstance } from 'class-transformer';
import { ReviewBookmarkCommand } from './review-bookmark.command';
import { BookmarksRepository } from '../bookmarks.repository';
import { CorrectionsRepository } from '../corrections.repository';
import { IngestService } from '../../ingest/ingest.service';
import { BookmarkResponseDto } from '../dto/bookmark-response.dto';
import type { BookmarkSelect } from '../../schema/bookmarks.schema';

@CommandHandler(ReviewBookmarkCommand)
export class ReviewBookmarkCommandHandler implements ICommandHandler<ReviewBookmarkCommand, BookmarkResponseDto> {
  constructor(
    @InjectPinoLogger(ReviewBookmarkCommandHandler.name) private readonly logger: PinoLogger,
    private readonly bookmarksRepository: BookmarksRepository,
    private readonly correctionsRepository: CorrectionsRepository,
    private readonly ingestService: IngestService,
  ) { }

  async execute(command: ReviewBookmarkCommand): Promise<BookmarkResponseDto> {
    const { bookmarkId, dto } = command;

    const bookmark = await this.getBookmarkOrThrow(bookmarkId);

    if (!dto.approved) return this.handleRejected(bookmarkId);

    const finalSummary = dto.editedSummary ?? bookmark.aiContentSummary;
    const finalTags = dto.editedTags ?? bookmark.aiTags;
    const wasEdited = Boolean(dto.editedSummary || dto.editedTags);

    this.logger.info({ bookmarkId, wasEdited }, 'Bookmark approved — generating embedding');

    const updated = await this.ingestService.embedAndComplete(
      bookmarkId,
      finalSummary,
      finalTags,
      bookmark.aiActionItems,
    );

    await this.correctionsRepository.insert({
      bookmarkId,
      aiSummary: bookmark.aiContentSummary,
      humanSummary: dto.editedSummary ?? null,
      aiTags: bookmark.aiTags,
      humanTags: dto.editedTags ?? null,
    });

    return plainToInstance(BookmarkResponseDto, updated, { excludeExtraneousValues: true });
  }

  private async getBookmarkOrThrow(bookmarkId: string): Promise<BookmarkSelect> {
    const bookmark = await this.bookmarksRepository.findById(bookmarkId);

    if (!bookmark) {
      throw new NotFoundException(`Bookmark ${bookmarkId} not found`);
    }

    if (bookmark.status !== 'REVIEW_PENDING') {
      throw new UnprocessableEntityException(
        `Bookmark ${bookmarkId} is not in REVIEW_PENDING state (current: ${bookmark.status})`,
      );
    }

    return bookmark;
  }

  private async handleRejected(bookmarkId: string): Promise<BookmarkResponseDto> {
    this.logger.info({ bookmarkId }, 'Bookmark rejected by reviewer');
    await this.bookmarksRepository.updateStatus(bookmarkId, 'FAILED', 'HUMAN_REJECTED');
    const rejected = (await this.bookmarksRepository.findById(bookmarkId))!;
    return plainToInstance(BookmarkResponseDto, rejected, { excludeExtraneousValues: true });
  }
}
