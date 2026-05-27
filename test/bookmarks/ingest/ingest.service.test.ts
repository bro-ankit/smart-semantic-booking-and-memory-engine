import { InternalServerErrorException } from '@nestjs/common';
import { TestBed } from '@automock/jest';
import { IngestService } from '../../../src/bookmarks/ingest/ingest.service';
import { EnrichmentService } from '../../../src/bookmarks/enrichment/enrichment.service';
import { BookmarksRepository } from '../../../src/bookmarks/bookmarks.repository';
import { TodosRepository } from '../../../src/bookmarks/todos.repository';
import { DrizzleTransactionService } from '../../../src/database/drizzle-transaction.service';
import { AI_CLIENT } from '../../../src/ai/ai.constants';
import type { IAiClient } from '../../../src/ai/ai.interface';
import type { BookmarkEnrichment } from '../../../src/bookmarks/enrichment/enrichment.zod';
import type { BookmarkSelect } from '../../../src/schema/bookmarks.schema';

describe('IngestService Unit Test', () => {
  let sut: IngestService;
  let enrichmentService: jest.Mocked<EnrichmentService>;
  let aiClient: jest.Mocked<IAiClient>;
  let transactionService: jest.Mocked<DrizzleTransactionService>;
  let bookmarksRepository: jest.Mocked<BookmarksRepository>;
  let todosRepository: jest.Mocked<TodosRepository>;

  const RAW_TEXT = 'https://example.com/kafka-partitioning-guide';

  const ENRICHMENT: BookmarkEnrichment = {
    contentSummary: 'A guide to Kafka partitioning strategies for high-throughput systems.',
    tags: ['kafka', 'partitioning', 'distributed-systems'],
    actionItems: ['Read the Kafka docs', 'Set up local Kafka cluster'],
  };

  const EMBEDDING = new Array(768).fill(0.01);

  const PENDING_BOOKMARK: BookmarkSelect = {
    id: 'abc-123',
    originalUrl: RAW_TEXT,
    contentSummary: '',
    tags: [],
    embedding: null,
    status: 'PENDING',
    errorMessage: null,
    createdAt: new Date('2026-05-20T00:00:00Z'),
  };

  const COMPLETED_BOOKMARK: BookmarkSelect = {
    ...PENDING_BOOKMARK,
    contentSummary: ENRICHMENT.contentSummary,
    tags: ENRICHMENT.tags,
    embedding: EMBEDDING,
    status: 'COMPLETED',
  };

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

  describe('Given ingest, When called', () => {
    describe('And the full pipeline succeeds', () => {
      beforeEach(() => {
        bookmarksRepository.insert.mockResolvedValue(PENDING_BOOKMARK);
        bookmarksRepository.updateStatus.mockResolvedValue(undefined);
        bookmarksRepository.updateEnrichment.mockResolvedValue(COMPLETED_BOOKMARK);
        enrichmentService.enrich.mockResolvedValue(ENRICHMENT);
        aiClient.generateEmbedding.mockResolvedValue(EMBEDDING);
        transactionService.execute.mockImplementation((fn) => fn());
        todosRepository.insertMany.mockResolvedValue(undefined);
      });

      test('Then it inserts a PENDING bookmark before calling the LLM', async () => {
        await sut.ingest({ rawText: RAW_TEXT });

        expect(bookmarksRepository.insert).toHaveBeenCalledWith({
          originalUrl: RAW_TEXT,
          status: 'PENDING',
        });
      });

      test('Then it transitions to PROCESSING before enrichment', async () => {
        await sut.ingest({ rawText: RAW_TEXT });

        const insertOrder = bookmarksRepository.insert.mock.invocationCallOrder[0]!;
        const processingOrder = bookmarksRepository.updateStatus.mock.invocationCallOrder[0]!;
        const enrichOrder = enrichmentService.enrich.mock.invocationCallOrder[0]!;

        expect(processingOrder).toBeGreaterThan(insertOrder);
        expect(enrichOrder).toBeGreaterThan(processingOrder);
        expect(bookmarksRepository.updateStatus).toHaveBeenCalledWith(PENDING_BOOKMARK.id, 'PROCESSING');
      });

      test('Then it calls enrichment with the raw text', async () => {
        await sut.ingest({ rawText: RAW_TEXT });
        expect(enrichmentService.enrich).toHaveBeenCalledWith(RAW_TEXT);
      });

      test('Then it builds the searchable string and passes it to the embedding client', async () => {
        await sut.ingest({ rawText: RAW_TEXT });

        const expectedSearchable = `${RAW_TEXT} ${ENRICHMENT.contentSummary} ${ENRICHMENT.tags.join(' ')}`;
        expect(aiClient.generateEmbedding).toHaveBeenCalledWith(expectedSearchable);
      });

      test('Then it updates the bookmark with enrichment data and COMPLETED status inside a transaction', async () => {
        await sut.ingest({ rawText: RAW_TEXT });

        expect(transactionService.execute).toHaveBeenCalledTimes(1);
        expect(bookmarksRepository.updateEnrichment).toHaveBeenCalledWith(PENDING_BOOKMARK.id, {
          contentSummary: ENRICHMENT.contentSummary,
          tags: ENRICHMENT.tags,
          embedding: EMBEDDING,
          status: 'COMPLETED',
        });
      });

      test('Then it inserts todos linked to the bookmark inside the same transaction', async () => {
        await sut.ingest({ rawText: RAW_TEXT });

        expect(todosRepository.insertMany).toHaveBeenCalledWith([
          { bookmarkId: PENDING_BOOKMARK.id, task: 'Read the Kafka docs' },
          { bookmarkId: PENDING_BOOKMARK.id, task: 'Set up local Kafka cluster' },
        ]);
      });

      test('Then it returns the completed bookmark', async () => {
        const result = await sut.ingest({ rawText: RAW_TEXT });
        expect(result).toEqual(COMPLETED_BOOKMARK);
      });
    });

    describe('And enrichment fails', () => {
      beforeEach(() => {
        bookmarksRepository.insert.mockResolvedValue(PENDING_BOOKMARK);
        bookmarksRepository.updateStatus.mockResolvedValue(undefined);
        enrichmentService.enrich.mockRejectedValue(
          new InternalServerErrorException('Gemini API call failed'),
        );
      });

      test('Then it marks the bookmark as FAILED with the error message and rethrows', async () => {
        await expect(sut.ingest({ rawText: RAW_TEXT })).rejects.toThrow('Gemini API call failed');

        expect(bookmarksRepository.updateStatus).toHaveBeenCalledWith(
          PENDING_BOOKMARK.id,
          'FAILED',
          'Gemini API call failed',
        );
      });

      test('Then it does not write enrichment data or todos', async () => {
        await sut.ingest({ rawText: RAW_TEXT }).catch(() => null);
        expect(bookmarksRepository.updateEnrichment).not.toHaveBeenCalled();
        expect(todosRepository.insertMany).not.toHaveBeenCalled();
      });
    });

    describe('And embedding generation fails', () => {
      beforeEach(() => {
        bookmarksRepository.insert.mockResolvedValue(PENDING_BOOKMARK);
        bookmarksRepository.updateStatus.mockResolvedValue(undefined);
        enrichmentService.enrich.mockResolvedValue(ENRICHMENT);
        aiClient.generateEmbedding.mockRejectedValue(
          new InternalServerErrorException('Embedding API call failed'),
        );
      });

      test('Then it marks the bookmark as FAILED with the error message and rethrows', async () => {
        await expect(sut.ingest({ rawText: RAW_TEXT })).rejects.toThrow('Embedding API call failed');

        expect(bookmarksRepository.updateStatus).toHaveBeenCalledWith(
          PENDING_BOOKMARK.id,
          'FAILED',
          'Embedding API call failed',
        );
      });

      test('Then it does not write enrichment data or todos', async () => {
        await sut.ingest({ rawText: RAW_TEXT }).catch(() => null);
        expect(bookmarksRepository.updateEnrichment).not.toHaveBeenCalled();
        expect(todosRepository.insertMany).not.toHaveBeenCalled();
      });
    });
  });
});
