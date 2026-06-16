import type { ReviewBookmarkDto } from '../dto/review-bookmark.dto';

export class ReviewBookmarkCommand {
  constructor(
    public readonly bookmarkId: string,
    public readonly dto: ReviewBookmarkDto,
  ) {}
}
