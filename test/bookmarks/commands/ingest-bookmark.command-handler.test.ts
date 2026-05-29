import { TestBed } from '@automock/jest';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { IngestBookmarkCommandHandler } from '../../../src/bookmarks/commands/ingest-bookmark.command-handler';
import { IngestBookmarkCommand } from '../../../src/bookmarks/commands/ingest-bookmark.command';
import { IngestService } from '../../../src/ingest/ingest.service';
import { BookmarksRepository } from '../../../src/bookmarks/bookmarks.repository';
import { SCRAPING_QUEUE, type ScrapingJobData } from '../../../src/scraper/scraper.constants';
import { mockBookmarkSelect } from '../../__mocks__/bookmark.mock';

describe('IngestBookmarkCommandHandler Unit Test', () => {
  let sut: IngestBookmarkCommandHandler;
  let ingestService: jest.Mocked<IngestService>;
  let bookmarksRepository: jest.Mocked<BookmarksRepository>;
  let scrapingQueue: jest.Mocked<Queue<ScrapingJobData>>;

  const BOOKMARK_ID = 'bookmark-uuid-001';
  const URL = 'https://example.com/kafka-partitioning';
  const RAW_TEXT = 'Kafka partitioning is a mechanism for distributing data across brokers.';

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
        scrapingQueue.add.mockResolvedValue({} as any);
      });

      test('Then it inserts a PENDING bookmark with the URL as originalUrl', async () => {
        await sut.execute(new IngestBookmarkCommand({ url: URL }));

        expect(bookmarksRepository.insert).toHaveBeenCalledWith({
          originalUrl: URL,
          status: 'PENDING',
        });
      });

      test('Then it enqueues a scrape-url job with the bookmark id and url', async () => {
        await sut.execute(new IngestBookmarkCommand({ url: URL }));

        expect(scrapingQueue.add).toHaveBeenCalledWith(
          'scrape-url',
          { bookmarkId: BOOKMARK_ID, url: URL },
          { jobId: BOOKMARK_ID },
        );
      });

      test('Then the job is enqueued after the bookmark is inserted', async () => {
        await sut.execute(new IngestBookmarkCommand({ url: URL }));

        const insertOrder = bookmarksRepository.insert.mock.invocationCallOrder[0]!;
        const enqueueOrder = scrapingQueue.add.mock.invocationCallOrder[0]!;

        expect(enqueueOrder).toBeGreaterThan(insertOrder);
      });

      test('Then it does not call ingestService', async () => {
        await sut.execute(new IngestBookmarkCommand({ url: URL }));
        expect(ingestService.ingest).not.toHaveBeenCalled();
      });

      test('Then it returns the PENDING bookmark', async () => {
        const result = await sut.execute(new IngestBookmarkCommand({ url: URL }));
        expect(result).toEqual(PENDING_BOOKMARK);
      });
    });

    describe('And the repository insert fails', () => {
      beforeEach(() => {
        bookmarksRepository.insert.mockRejectedValue(new Error('DB connection lost'));
      });

      test('Then it propagates the error without enqueueing', async () => {
        await expect(
          sut.execute(new IngestBookmarkCommand({ url: URL })),
        ).rejects.toThrow('DB connection lost');

        expect(scrapingQueue.add).not.toHaveBeenCalled();
      });
    });

    describe('And the queue add fails', () => {
      beforeEach(() => {
        bookmarksRepository.insert.mockResolvedValue(PENDING_BOOKMARK);
        scrapingQueue.add.mockRejectedValue(new Error('Redis unavailable'));
      });

      test('Then it propagates the error', async () => {
        await expect(
          sut.execute(new IngestBookmarkCommand({ url: URL })),
        ).rejects.toThrow('Redis unavailable');
      });
    });
  });

  describe('Given execute, When called with rawText', () => {
    describe('And ingestService succeeds', () => {
      beforeEach(() => {
        ingestService.ingest.mockResolvedValue(COMPLETED_BOOKMARK);
      });

      test('Then it delegates to ingestService with the full dto', async () => {
        const dto = { rawText: RAW_TEXT };
        await sut.execute(new IngestBookmarkCommand(dto));

        expect(ingestService.ingest).toHaveBeenCalledWith(dto);
      });

      test('Then it does not insert a bookmark or touch the queue', async () => {
        await sut.execute(new IngestBookmarkCommand({ rawText: RAW_TEXT }));

        expect(bookmarksRepository.insert).not.toHaveBeenCalled();
        expect(scrapingQueue.add).not.toHaveBeenCalled();
      });

      test('Then it returns the completed bookmark from ingestService', async () => {
        const result = await sut.execute(new IngestBookmarkCommand({ rawText: RAW_TEXT }));
        expect(result).toEqual(COMPLETED_BOOKMARK);
      });
    });

    describe('And ingestService throws', () => {
      beforeEach(() => {
        ingestService.ingest.mockRejectedValue(new Error('Gemini enrichment failed'));
      });

      test('Then it propagates the error', async () => {
        await expect(
          sut.execute(new IngestBookmarkCommand({ rawText: RAW_TEXT })),
        ).rejects.toThrow('Gemini enrichment failed');
      });
    });
  });
});
