import type { BookmarkSelect } from '../../src/schema/bookmarks.schema';
import type { CorrectionSelect } from '../../src/schema/corrections.schema';

export const mockBookmarkSelect = (overrides: Partial<BookmarkSelect> = {}): BookmarkSelect => ({
  id: 'bookmark-uuid-001',
  originalUrl: 'https://example.com/kafka-partitioning',
  contentSummary: '',
  tags: [],
  embedding: null,
  tsvContent: null,
  status: 'PENDING',
  errorMessage: null,
  aiContentSummary: '',
  aiTags: [],
  aiActionItems: [],
  createdAt: new Date('2026-05-29T00:00:00Z'),
  ...overrides,
});

export const mockCorrectionSelect = (overrides: Partial<CorrectionSelect> = {}): CorrectionSelect => ({
  id: 'correction-uuid-001',
  bookmarkId: 'bookmark-uuid-001',
  aiSummary: 'AI-generated summary.',
  humanSummary: null,
  aiTags: ['kafka'],
  humanTags: null,
  createdAt: new Date('2026-05-29T00:00:00Z'),
  ...overrides,
});
