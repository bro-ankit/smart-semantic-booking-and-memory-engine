import { TestBed } from '@automock/jest';

import { BookmarksRepository } from '../../../src/bookmarks/bookmarks.repository';
import { CorrectionsRepository } from '../../../src/bookmarks/corrections.repository';
import { ReviewBookmarkCommand } from '../../../src/bookmarks/review/review-bookmark.command';
import { ReviewBookmarkCommandHandler } from '../../../src/bookmarks/review/review-bookmark.command-handler';
import { IngestService } from '../../../src/ingest/ingest.service';
import { mockBookmarkSelect, mockCorrectionSelect } from '../../__mocks__/bookmark.mock';
import { AssertUtils } from '../../utils/assert.utils';

const BOOKMARK_ID = 'bookmark-uuid-001';
const ORIGINAL_URL = 'https://example.com/kafka-partitioning';
const CREATED_AT = new Date('2026-05-29T00:00:00Z');
const EMBEDDING = new Array(768).fill(0.01);

const BASE_DTO = {
  originalUrl: ORIGINAL_URL,
  contentSummary: '',
  tags: [],
  errorMessage: null,
  aiContentSummary: '',
  aiTags: [],
  aiActionItems: [],
  createdAt: CREATED_AT,
};

describe('ReviewBookmarkCommandHandler Unit Test', () => {
  let sut: ReviewBookmarkCommandHandler;
  let bookmarksRepository: jest.Mocked<BookmarksRepository>;
  let correctionsRepository: jest.Mocked<CorrectionsRepository>;
  let ingestService: jest.Mocked<IngestService>;

  const REVIEW_PENDING = mockBookmarkSelect({
    id: BOOKMARK_ID,
    status: 'REVIEW_PENDING',
    aiContentSummary: 'AI-generated summary about Kafka.',
    aiTags: ['kafka', 'partitioning'],
    aiActionItems: ['Read Kafka docs', 'Set up cluster'],
  });
  const COMPLETED = mockBookmarkSelect({ id: BOOKMARK_ID, status: 'COMPLETED', embedding: EMBEDDING });
  const FAILED = mockBookmarkSelect({ id: BOOKMARK_ID, status: 'FAILED', errorMessage: 'HUMAN_REJECTED' });

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(ReviewBookmarkCommandHandler).compile();
    sut = unit;
    bookmarksRepository = unitRef.get(BookmarksRepository);
    correctionsRepository = unitRef.get(CorrectionsRepository);
    ingestService = unitRef.get(IngestService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given execute', () => {
    describe('When the bookmark does not exist', () => {
      test('Then it throws NotFoundException', async () => {
        bookmarksRepository.findById.mockResolvedValue(undefined);
        await AssertUtils.assertError(
          () => sut.execute(new ReviewBookmarkCommand(BOOKMARK_ID, { approved: true })),
          `Bookmark ${BOOKMARK_ID} not found`,
          404,
        );
      });
    });

    describe('When the bookmark is not in REVIEW_PENDING', () => {
      test('Then it throws UnprocessableEntityException', async () => {
        bookmarksRepository.findById.mockResolvedValue(mockBookmarkSelect({ status: 'COMPLETED' }));
        await AssertUtils.assertError(
          () => sut.execute(new ReviewBookmarkCommand(BOOKMARK_ID, { approved: true })),
          `Bookmark ${BOOKMARK_ID} is not in REVIEW_PENDING state (current: COMPLETED)`,
          422,
        );
      });
    });

    describe('When approved without edits', () => {
      test('Then it embeds using AI values, logs a no-edit correction, and returns the completed DTO', async () => {
        bookmarksRepository.findById.mockResolvedValue(REVIEW_PENDING);
        ingestService.embedAndComplete.mockResolvedValue(COMPLETED);
        correctionsRepository.insert.mockResolvedValue(mockCorrectionSelect({ bookmarkId: BOOKMARK_ID }));

        const result = await sut.execute(new ReviewBookmarkCommand(BOOKMARK_ID, { approved: true }));

        expect(ingestService.embedAndComplete).toHaveBeenCalledWith(
          BOOKMARK_ID,
          REVIEW_PENDING.aiContentSummary,
          REVIEW_PENDING.aiTags,
          REVIEW_PENDING.aiActionItems,
        );
        expect(correctionsRepository.insert).toHaveBeenCalledWith({
          bookmarkId: BOOKMARK_ID,
          aiSummary: REVIEW_PENDING.aiContentSummary,
          humanSummary: null,
          aiTags: REVIEW_PENDING.aiTags,
          humanTags: null,
        });
        expect(result).toEqual({ id: BOOKMARK_ID, ...BASE_DTO, status: 'COMPLETED' });
      });
    });

    describe('When approved with human edits', () => {
      test('Then it embeds using edited values, logs the correction delta, and returns the completed DTO', async () => {
        const editedSummary = 'Human-corrected summary.';
        const editedTags = ['kafka', 'corrected'];
        const editedCompleted = mockBookmarkSelect({
          id: BOOKMARK_ID,
          status: 'COMPLETED',
          contentSummary: editedSummary,
        });

        bookmarksRepository.findById.mockResolvedValue(REVIEW_PENDING);
        ingestService.embedAndComplete.mockResolvedValue(editedCompleted);
        correctionsRepository.insert.mockResolvedValue(
          mockCorrectionSelect({ bookmarkId: BOOKMARK_ID, humanSummary: editedSummary, humanTags: editedTags }),
        );

        const result = await sut.execute(
          new ReviewBookmarkCommand(BOOKMARK_ID, { approved: true, editedSummary, editedTags }),
        );

        expect(ingestService.embedAndComplete).toHaveBeenCalledWith(
          BOOKMARK_ID,
          editedSummary,
          editedTags,
          REVIEW_PENDING.aiActionItems,
        );
        expect(correctionsRepository.insert).toHaveBeenCalledWith({
          bookmarkId: BOOKMARK_ID,
          aiSummary: REVIEW_PENDING.aiContentSummary,
          humanSummary: editedSummary,
          aiTags: REVIEW_PENDING.aiTags,
          humanTags: editedTags,
        });
        expect(result).toEqual({ id: BOOKMARK_ID, ...BASE_DTO, status: 'COMPLETED', contentSummary: editedSummary });
      });
    });

    describe('When rejected', () => {
      test('Then it marks FAILED with HUMAN_REJECTED, skips embed and correction, and returns the failed DTO', async () => {
        bookmarksRepository.findById.mockResolvedValueOnce(REVIEW_PENDING).mockResolvedValueOnce(FAILED);
        bookmarksRepository.updateStatus.mockResolvedValue(undefined);

        const result = await sut.execute(new ReviewBookmarkCommand(BOOKMARK_ID, { approved: false }));

        expect(bookmarksRepository.updateStatus).toHaveBeenCalledWith(BOOKMARK_ID, 'FAILED', 'HUMAN_REJECTED');
        expect(ingestService.embedAndComplete).not.toHaveBeenCalled();
        expect(correctionsRepository.insert).not.toHaveBeenCalled();
        expect(result).toEqual({ id: BOOKMARK_ID, ...BASE_DTO, status: 'FAILED', errorMessage: 'HUMAN_REJECTED' });
      });
    });
  });
});
