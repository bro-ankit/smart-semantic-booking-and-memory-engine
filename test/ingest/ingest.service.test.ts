import { TestBed } from '@automock/jest';
import { InternalServerErrorException } from '@nestjs/common';

import { AI_CLIENT } from '../../src/ai/ai.constants';
import type { IAiClient } from '../../src/ai/ai.interface';
import { BookmarksRepository } from '../../src/bookmarks/bookmarks.repository';
import { EnrichmentService } from '../../src/bookmarks/enrichment/enrichment.service';
import type { BookmarkEnrichment } from '../../src/bookmarks/enrichment/enrichment.zod';
import { TodosRepository } from '../../src/bookmarks/todos.repository';
import { DrizzleTransactionService } from '../../src/database/drizzle-transaction.service';
import { IngestService } from '../../src/ingest/ingest.service';
import { mockBookmarkSelect } from '../__mocks__/bookmark.mock';

describe('IngestService Unit Test', () => {
  let sut: IngestService;
  let enrichmentService: jest.Mocked<EnrichmentService>;
  let aiClient: jest.Mocked<IAiClient>;
  let transactionService: jest.Mocked<DrizzleTransactionService>;
  let bookmarksRepository: jest.Mocked<BookmarksRepository>;
  let todosRepository: jest.Mocked<TodosRepository>;

  const RAW_TEXT = 'Kafka partitioning distributes data across brokers.';
  const BOOKMARK_ID = 'abc-123';
  const EMBEDDING = new Array(768).fill(0.01);

  const ENRICHMENT: BookmarkEnrichment = {
    contentSummary: 'A guide to Kafka partitioning.',
    tags: ['kafka', 'partitioning'],
    actionItems: ['Read Kafka docs', 'Set up cluster'],
  };

  const PENDING = mockBookmarkSelect({ id: BOOKMARK_ID, status: 'PENDING' });
  const REVIEW_PENDING = mockBookmarkSelect({
    id: BOOKMARK_ID,
    status: 'REVIEW_PENDING',
    aiContentSummary: ENRICHMENT.contentSummary,
    aiTags: ENRICHMENT.tags,
    aiActionItems: ENRICHMENT.actionItems,
  });
  const COMPLETED = mockBookmarkSelect({ id: BOOKMARK_ID, status: 'COMPLETED', embedding: EMBEDDING });

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(IngestService).compile();
    sut = unit;
    enrichmentService = unitRef.get(EnrichmentService);
    aiClient = unitRef.get(AI_CLIENT);
    transactionService = unitRef.get(DrizzleTransactionService);
    bookmarksRepository = unitRef.get(BookmarksRepository);
    todosRepository = unitRef.get(TodosRepository);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given ingest, When enrichment succeeds', () => {
    test('Then it inserts PENDING, transitions to PROCESSING, saves AI output as REVIEW_PENDING, and skips embedding', async () => {
      bookmarksRepository.insert.mockResolvedValue(PENDING);
      bookmarksRepository.updateStatus.mockResolvedValue(undefined);
      bookmarksRepository.updateWithAiEnrichment.mockResolvedValue(REVIEW_PENDING);
      enrichmentService.enrich.mockResolvedValue(ENRICHMENT);

      const result = await sut.ingest({ rawText: RAW_TEXT });

      expect(bookmarksRepository.insert).toHaveBeenCalledWith({ originalUrl: RAW_TEXT, status: 'PENDING' });
      expect(bookmarksRepository.updateStatus).toHaveBeenCalledWith(BOOKMARK_ID, 'PROCESSING');
      expect(enrichmentService.enrich).toHaveBeenCalledWith(RAW_TEXT);
      expect(bookmarksRepository.updateWithAiEnrichment).toHaveBeenCalledWith(BOOKMARK_ID, {
        aiContentSummary: ENRICHMENT.contentSummary,
        aiTags: ENRICHMENT.tags,
        aiActionItems: ENRICHMENT.actionItems,
      });
      expect(aiClient.generateEmbedding).not.toHaveBeenCalled();
      expect(result).toEqual(REVIEW_PENDING);
    });
  });

  describe('Given ingest, When enrichment fails', () => {
    test('Then it marks FAILED with the error message and rethrows without saving enrichment data', async () => {
      bookmarksRepository.insert.mockResolvedValue(PENDING);
      bookmarksRepository.updateStatus.mockResolvedValue(undefined);
      enrichmentService.enrich.mockRejectedValue(new InternalServerErrorException('Gemini API call failed'));

      await expect(sut.ingest({ rawText: RAW_TEXT })).rejects.toThrow('Gemini API call failed');

      expect(bookmarksRepository.updateStatus).toHaveBeenCalledWith(BOOKMARK_ID, 'FAILED', 'Gemini API call failed');
      expect(bookmarksRepository.updateWithAiEnrichment).not.toHaveBeenCalled();
    });
  });

  describe('Given embedAndComplete, When all steps succeed', () => {
    test('Then it embeds, updates to COMPLETED, inserts todos in a transaction, and returns the result', async () => {
      const SUMMARY = 'Approved summary.';
      const TAGS = ['kafka', 'approved'];
      const ITEMS = ['Read Kafka docs', 'Set up cluster'];

      aiClient.generateEmbedding.mockResolvedValue(EMBEDDING);
      transactionService.execute.mockImplementation((fn) => fn());
      bookmarksRepository.updateEnrichment.mockResolvedValue(COMPLETED);
      todosRepository.insertMany.mockResolvedValue(undefined);

      const result = await sut.embedAndComplete(BOOKMARK_ID, SUMMARY, TAGS, ITEMS);

      expect(aiClient.generateEmbedding).toHaveBeenCalledWith(`${SUMMARY} ${TAGS.join(' ')}`);
      expect(transactionService.execute).toHaveBeenCalledTimes(1);
      expect(bookmarksRepository.updateEnrichment).toHaveBeenCalledWith(BOOKMARK_ID, {
        contentSummary: SUMMARY,
        tags: TAGS,
        embedding: EMBEDDING,
        status: 'COMPLETED',
      });
      expect(todosRepository.insertMany).toHaveBeenCalledWith([
        { bookmarkId: BOOKMARK_ID, task: 'Read Kafka docs' },
        { bookmarkId: BOOKMARK_ID, task: 'Set up cluster' },
      ]);
      expect(result).toEqual(COMPLETED);
    });
  });

  describe('Given embedAndComplete, When embedding fails', () => {
    test('Then it propagates the error without touching the database', async () => {
      aiClient.generateEmbedding.mockRejectedValue(new InternalServerErrorException('Embedding API failed'));

      await expect(sut.embedAndComplete(BOOKMARK_ID, 'summary', ['tag'], [])).rejects.toThrow('Embedding API failed');

      expect(bookmarksRepository.updateEnrichment).not.toHaveBeenCalled();
      expect(todosRepository.insertMany).not.toHaveBeenCalled();
    });
  });
});
