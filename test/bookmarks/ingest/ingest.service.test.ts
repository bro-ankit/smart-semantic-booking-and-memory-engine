import { HttpStatus, InternalServerErrorException } from '@nestjs/common';
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
import { AssertUtils } from '../../utils/assert.utils';

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

  const PERSISTED_BOOKMARK: BookmarkSelect = {
    id: 'abc-123',
    originalUrl: RAW_TEXT,
    contentSummary: ENRICHMENT.contentSummary,
    tags: ENRICHMENT.tags,
    embedding: EMBEDDING,
    status: 'COMPLETED',
    errorMessage: null,
    createdAt: new Date('2026-05-20T00:00:00Z'),
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
        enrichmentService.enrich.mockResolvedValue(ENRICHMENT);
        aiClient.generateEmbedding.mockResolvedValue(EMBEDDING);
        transactionService.execute.mockImplementation((fn) => fn());
        bookmarksRepository.insert.mockResolvedValue(PERSISTED_BOOKMARK);
        todosRepository.insertMany.mockResolvedValue(undefined);
      });

      test('Then it returns the persisted bookmark', async () => {
        const result = await sut.ingest({ rawText: RAW_TEXT });

        expect(result).toEqual(PERSISTED_BOOKMARK);
      });

      test('Then it calls enrichment with raw text', async () => {
        await sut.ingest({ rawText: RAW_TEXT });

        expect(enrichmentService.enrich).toHaveBeenCalledWith(RAW_TEXT);
      });

      test('Then it builds the searchable string and passes it to the embedding client', async () => {
        await sut.ingest({ rawText: RAW_TEXT });

        const expectedSearchable = `${RAW_TEXT} ${ENRICHMENT.contentSummary} ${ENRICHMENT.tags.join(' ')}`;
        expect(aiClient.generateEmbedding).toHaveBeenCalledWith(expectedSearchable);
      });

      test('Then it inserts the bookmark with enrichment data, embedding, and COMPLETED status', async () => {
        await sut.ingest({ rawText: RAW_TEXT });

        expect(bookmarksRepository.insert).toHaveBeenCalledWith({
          originalUrl: RAW_TEXT,
          contentSummary: ENRICHMENT.contentSummary,
          tags: ENRICHMENT.tags,
          embedding: EMBEDDING,
          status: 'COMPLETED',
        });
      });

      test('Then it inserts todos mapped to the persisted bookmark id', async () => {
        await sut.ingest({ rawText: RAW_TEXT });

        expect(todosRepository.insertMany).toHaveBeenCalledWith([
          { bookmarkId: PERSISTED_BOOKMARK.id, task: 'Read the Kafka docs' },
          { bookmarkId: PERSISTED_BOOKMARK.id, task: 'Set up local Kafka cluster' },
        ]);
      });

      test('Then it wraps the DB writes in a transaction', async () => {
        await sut.ingest({ rawText: RAW_TEXT });

        expect(transactionService.execute).toHaveBeenCalledTimes(1);
      });
    });

    describe.each([
      {
        label: 'enrichment fails',
        setup: (deps: { enrichmentService: jest.Mocked<EnrichmentService> }) => {
          deps.enrichmentService.enrich.mockRejectedValueOnce(
            new InternalServerErrorException('AI response failed schema validation'),
          );
        },
        expectedMessage: 'AI response failed schema validation',
        expectedStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      {
        label: 'embedding fails',
        setup: (deps: {
          enrichmentService: jest.Mocked<EnrichmentService>;
          aiClient: jest.Mocked<IAiClient>;
        }) => {
          deps.enrichmentService.enrich.mockResolvedValueOnce(ENRICHMENT);
          deps.aiClient.generateEmbedding.mockRejectedValueOnce(
            new InternalServerErrorException('Gemini API call failed'),
          );
        },
        expectedMessage: 'Gemini API call failed',
        expectedStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      },
    ])('And $label', ({ setup, expectedMessage, expectedStatus }) => {
      test(`Then it throws 500 with message "${expectedMessage}"`, async () => {
        setup({ enrichmentService, aiClient });

        await AssertUtils.assertError(
          () => sut.ingest({ rawText: RAW_TEXT }),
          expectedMessage,
          expectedStatus,
        );
      });
    });
  });
});
