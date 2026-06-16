import { TestBed } from '@automock/jest';
import { GetPendingReviewQueryHandler } from '../../../src/bookmarks/review/get-pending-review.query-handler';
import { GetPendingReviewQuery } from '../../../src/bookmarks/review/get-pending-review.query';
import { BookmarksRepository } from '../../../src/bookmarks/bookmarks.repository';
import { mockBookmarkSelect } from '../../__mocks__/bookmark.mock';

const CREATED_AT = new Date('2026-05-29T00:00:00Z');
const ORIGINAL_URL = 'https://example.com/kafka-partitioning';

describe('GetPendingReviewQueryHandler Unit Test', () => {
  let sut: GetPendingReviewQueryHandler;
  let bookmarksRepository: jest.Mocked<BookmarksRepository>;

  const PENDING_REVIEWS = [
    mockBookmarkSelect({ id: 'uuid-1', status: 'REVIEW_PENDING' }),
    mockBookmarkSelect({ id: 'uuid-2', status: 'REVIEW_PENDING' }),
  ];

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(GetPendingReviewQueryHandler).compile();
    sut = unit;
    bookmarksRepository = unitRef.get(BookmarksRepository);

    bookmarksRepository.findByStatus.mockResolvedValue(PENDING_REVIEWS);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given execute, When called', () => {
    test('Then it queries REVIEW_PENDING and returns the mapped DTOs', async () => {
      const result = await sut.execute(new GetPendingReviewQuery());

      expect(bookmarksRepository.findByStatus).toHaveBeenCalledWith('REVIEW_PENDING');
      expect(result).toEqual([
        { id: 'uuid-1', originalUrl: ORIGINAL_URL, contentSummary: '', tags: [], status: 'REVIEW_PENDING', errorMessage: null, aiContentSummary: '', aiTags: [], aiActionItems: [], createdAt: CREATED_AT },
        { id: 'uuid-2', originalUrl: ORIGINAL_URL, contentSummary: '', tags: [], status: 'REVIEW_PENDING', errorMessage: null, aiContentSummary: '', aiTags: [], aiActionItems: [], createdAt: CREATED_AT },
      ]);
    });
  });
});
