import { GetPendingReviewQueryHandler } from './get-pending-review.query-handler';
import { ReviewBookmarkCommandHandler } from './review-bookmark.command-handler';

export const REVIEW_HANDLERS = [ReviewBookmarkCommandHandler, GetPendingReviewQueryHandler];
