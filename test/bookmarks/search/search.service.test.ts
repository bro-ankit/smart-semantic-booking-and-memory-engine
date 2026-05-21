import { TestBed } from '@automock/jest';
import { SearchService } from '../../../src/bookmarks/search/search.service';
import { BookmarksRepository } from '../../../src/bookmarks/bookmarks.repository';
import { AI_CLIENT } from '../../../src/ai/ai.constants';
import type { IAiClient } from '../../../src/ai/ai.interface';
import type { BookmarkSelect } from '../../../src/schema/bookmarks.schema';

describe('SearchService Unit Test', () => {
  let sut: SearchService;
  let aiClient: jest.Mocked<IAiClient>;
  let bookmarksRepository: jest.Mocked<BookmarksRepository>;

  const QUERY = 'how does Kafka handle message ordering';
  const EMBEDDING = new Array(768).fill(0.05);

  const BOOKMARK_ROWS: BookmarkSelect[] = [
    {
      id: 'id-1',
      originalUrl: 'https://example.com/kafka-partitioning',
      contentSummary: 'Deep dive into Kafka partitioning and ordering guarantees.',
      tags: ['kafka', 'streaming'],
      embedding: EMBEDDING,
      status: 'COMPLETED',
      errorMessage: null,
      createdAt: new Date('2026-05-20T00:00:00Z'),
    },
    {
      id: 'id-2',
      originalUrl: 'https://example.com/kafka-consumers',
      contentSummary: 'Consumer group rebalancing in Apache Kafka.',
      tags: ['kafka', 'consumers'],
      embedding: EMBEDDING,
      status: 'COMPLETED',
      errorMessage: null,
      createdAt: new Date('2026-05-20T01:00:00Z'),
    },
    {
      id: 'id-3',
      originalUrl: 'https://example.com/event-streaming',
      contentSummary: 'Event streaming patterns for distributed systems.',
      tags: ['events', 'distributed'],
      embedding: EMBEDDING,
      status: 'COMPLETED',
      errorMessage: null,
      createdAt: new Date('2026-05-20T02:00:00Z'),
    },
  ];

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(SearchService).compile();
    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
    bookmarksRepository = unitRef.get(BookmarksRepository);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given search, When called', () => {
    describe('And matching bookmarks exist', () => {
      beforeEach(() => {
        aiClient.generateEmbedding.mockResolvedValue(EMBEDDING);
        bookmarksRepository.findSimilar.mockResolvedValue(BOOKMARK_ROWS);
      });

      test('Then it returns mapped SearchResultDtos without the embedding field', async () => {
        const results = await sut.search(QUERY);

        expect(results).toEqual([
          {
            id: 'id-1',
            originalUrl: 'https://example.com/kafka-partitioning',
            contentSummary: 'Deep dive into Kafka partitioning and ordering guarantees.',
            tags: ['kafka', 'streaming'],
            status: 'COMPLETED',
            createdAt: new Date('2026-05-20T00:00:00Z'),
          },
          {
            id: 'id-2',
            originalUrl: 'https://example.com/kafka-consumers',
            contentSummary: 'Consumer group rebalancing in Apache Kafka.',
            tags: ['kafka', 'consumers'],
            status: 'COMPLETED',
            createdAt: new Date('2026-05-20T01:00:00Z'),
          },
          {
            id: 'id-3',
            originalUrl: 'https://example.com/event-streaming',
            contentSummary: 'Event streaming patterns for distributed systems.',
            tags: ['events', 'distributed'],
            status: 'COMPLETED',
            createdAt: new Date('2026-05-20T02:00:00Z'),
          },
        ]);
      });

      test('Then it embeds the query and passes it to the repository with limit 3', async () => {
        await sut.search(QUERY);

        expect(aiClient.generateEmbedding).toHaveBeenCalledWith(QUERY);
        expect(bookmarksRepository.findSimilar).toHaveBeenCalledWith(EMBEDDING, 3);
      });
    });

    describe('And no bookmarks match', () => {
      test('Then it returns an empty array', async () => {
        aiClient.generateEmbedding.mockResolvedValue(EMBEDDING);
        bookmarksRepository.findSimilar.mockResolvedValue([]);

        const results = await sut.search(QUERY);

        expect(results).toEqual([]);
      });
    });
  });
});
