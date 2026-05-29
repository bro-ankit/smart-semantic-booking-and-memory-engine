import type { BookmarkSelect } from '../../src/schema/bookmarks.schema';

export const mockBookmarkSelect = (overrides: Partial<BookmarkSelect> = {}): BookmarkSelect => ({
  id: 'bookmark-uuid-001',
  originalUrl: 'https://example.com/kafka-partitioning',
  contentSummary: '',
  tags: [],
  embedding: null,
  status: 'PENDING',
  errorMessage: null,
  createdAt: new Date('2026-05-29T00:00:00Z'),
  ...overrides,
});
