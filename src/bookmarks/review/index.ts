import { ReviewBookmarkCommandHandler } from './review-bookmark.command-handler';
import { GetPendingReviewQueryHandler } from './get-pending-review.query-handler';

export const REVIEW_HANDLERS = [ReviewBookmarkCommandHandler, GetPendingReviewQueryHandler];
