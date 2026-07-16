import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { BookmarksRepository } from '../bookmarks.repository';
import { BookmarkResponseDto } from '../dto/bookmark-response.dto';
import { GetPendingReviewQuery } from './get-pending-review.query';

@QueryHandler(GetPendingReviewQuery)
export class GetPendingReviewQueryHandler implements IQueryHandler<GetPendingReviewQuery, BookmarkResponseDto[]> {
  constructor(
    @InjectPinoLogger(GetPendingReviewQueryHandler.name) private readonly logger: PinoLogger,
    private readonly bookmarksRepository: BookmarksRepository,
  ) {}

  async execute(_query: GetPendingReviewQuery): Promise<BookmarkResponseDto[]> {
    this.logger.debug('Fetching bookmarks in REVIEW_PENDING state');
    const bookmarks = await this.bookmarksRepository.findByStatus('REVIEW_PENDING');
    return plainToInstance(BookmarkResponseDto, bookmarks, { excludeExtraneousValues: true });
  }
}
