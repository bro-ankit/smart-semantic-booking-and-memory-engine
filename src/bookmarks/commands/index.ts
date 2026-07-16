import { ReviewBookmarkCommandHandler } from '../review/review-bookmark.command-handler';
import { IngestBookmarkCommandHandler } from './ingest-bookmark.command-handler';

export const BOOKMARK_COMMAND_HANDLERS = [IngestBookmarkCommandHandler, ReviewBookmarkCommandHandler];
