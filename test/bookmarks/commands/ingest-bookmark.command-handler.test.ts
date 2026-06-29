import { TestBed } from '@automock/jest';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { IngestBookmarkCommandHandler } from '../../../src/bookmarks/commands/ingest-bookmark.command-handler';
import { IngestBookmarkCommand } from '../../../src/bookmarks/commands/ingest-bookmark.command';
import { IngestService } from '../../../src/ingest/ingest.service';
import { BookmarksRepository } from '../../../src/bookmarks/bookmarks.repository';
import { SCRAPING_QUEUE, type ScrapingJobData } from '../../../src/scraper/scraper.constants';
import { AssertUtils } from '../../utils/assert.utils';
import { mockBookmarkSelect } from '../../__mocks__/bookmark.mock';

const BOOKMARK_ID = 'bookmark-uuid-001';
const URL = 'https://example.com/kafka-partitioning';
const RAW_TEXT = 'Kafka partitioning is a mechanism for distributing data across brokers.';
const CREATED_AT = new Date('2026-05-29T00:00:00Z');

describe('IngestBookmarkCommandHandler Unit Test', () => {
  let sut: IngestBookmarkCommandHandler;
  let ingestService: jest.Mocked<IngestService>;
  let bookmarksRepository: jest.Mocked<BookmarksRepository>;
  let scrapingQueue: jest.Mocked<Queue<ScrapingJobData>>;

  const PENDING_BOOKMARK = mockBookmarkSelect({ id: BOOKMARK_ID, originalUrl: URL, status: 'PENDING' });
  const COMPLETED_BOOKMARK = mockBookmarkSelect({
    id: BOOKMARK_ID,
    originalUrl: RAW_TEXT,
    contentSummary: 'A guide to Kafka partitioning for high-throughput distributed systems.',
    tags: ['kafka', 'partitioning', 'distributed-systems'],
    embedding: new Array(768).fill(0.01),
    status: 'COMPLETED',
  });

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(IngestBookmarkCommandHandler).compile();
    sut = unit;
    ingestService = unitRef.get(IngestService);
    bookmarksRepository = unitRef.get(BookmarksRepository);
    scrapingQueue = unitRef.get(getQueueToken(SCRAPING_QUEUE));
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given execute, When called with a URL', () => {
    describe('And the insert and enqueue both succeed', () => {
      beforeEach(() => {
        bookmarksRepository.insert.mockResolvedValue(PENDING_BOOKMARK);
        scrapingQueue.add.mockResolvedValue({} as never);
      });

      test('Then it inserts a PENDING bookmark, enqueues the scrape job, skips ingestService, and returns the DTO', async () => {
        const result = await sut.execute(new IngestBookmarkCommand({ url: URL }));

        expect(bookmarksRepository.insert).toHaveBeenCalledWith({ originalUrl: URL, status: 'PENDING' });
        expect(scrapingQueue.add).toHaveBeenCalledWith(
          'scrape-url',
          { bookmarkId: BOOKMARK_ID, url: URL },
          { jobId: BOOKMARK_ID },
        );
        expect(ingestService.ingest).not.toHaveBeenCalled();
        expect(result).toEqual({
          id: BOOKMARK_ID,
          originalUrl: URL,
          contentSummary: '',
          tags: [],
          status: 'PENDING',
          errorMessage: null,
          aiContentSummary: '',
          aiTags: [],
          aiActionItems: [],
          createdAt: CREATED_AT,
        });
      });

      test('Then the scrape job is enqueued after the bookmark is inserted', async () => {
        await sut.execute(new IngestBookmarkCommand({ url: URL }));

        const insertOrder = bookmarksRepository.insert.mock.invocationCallOrder[0]!;
        const enqueueOrder = scrapingQueue.add.mock.invocationCallOrder[0]!;

        expect(enqueueOrder).toBeGreaterThan(insertOrder);
      });
    });

    describe('And the repository insert fails', () => {
      test('Then it propagates the error without enqueueing', async () => {
        bookmarksRepository.insert.mockRejectedValue(new Error('DB connection lost'));

        await AssertUtils.assertThrows(
          () => sut.execute(new IngestBookmarkCommand({ url: URL })),
          'DB connection lost',
        );
        expect(scrapingQueue.add).not.toHaveBeenCalled();
      });
    });

    describe('And the queue add fails', () => {
      test('Then it propagates the error', async () => {
        bookmarksRepository.insert.mockResolvedValue(PENDING_BOOKMARK);
        scrapingQueue.add.mockRejectedValue(new Error('Redis unavailable'));

        await AssertUtils.assertThrows(
          () => sut.execute(new IngestBookmarkCommand({ url: URL })),
          'Redis unavailable',
        );
      });
    });
  });

  describe('Given execute, When called with rawText', () => {
    describe('And ingestService succeeds', () => {
      test('Then it delegates to ingestService, skips the queue, and returns the DTO', async () => {
        const dto = { rawText: RAW_TEXT };
        ingestService.ingest.mockResolvedValue(COMPLETED_BOOKMARK);

        const result = await sut.execute(new IngestBookmarkCommand(dto));

        expect(ingestService.ingest).toHaveBeenCalledWith(dto);
        expect(bookmarksRepository.insert).not.toHaveBeenCalled();
        expect(scrapingQueue.add).not.toHaveBeenCalled();
        expect(result).toEqual({
          id: BOOKMARK_ID,
          originalUrl: RAW_TEXT,
          contentSummary: 'A guide to Kafka partitioning for high-throughput distributed systems.',
          tags: ['kafka', 'partitioning', 'distributed-systems'],
          status: 'COMPLETED',
          errorMessage: null,
          aiContentSummary: '',
          aiTags: [],
          aiActionItems: [],
          createdAt: CREATED_AT,
        });
      });
    });

    describe('And ingestService throws', () => {
      test('Then it propagates the error', async () => {
        ingestService.ingest.mockRejectedValue(new Error('Gemini enrichment failed'));

        await AssertUtils.assertThrows(
          () => sut.execute(new IngestBookmarkCommand({ rawText: RAW_TEXT })),
          'Gemini enrichment failed',
        );
      });
    });
  });
});
