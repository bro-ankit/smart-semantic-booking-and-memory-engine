import { TestBed } from '@automock/jest';
import { SearchService } from '../../../src/bookmarks/search/search.service';
import { BookmarksRepository } from '../../../src/bookmarks/bookmarks.repository';
import { AI_CLIENT } from '../../../src/ai/ai.constants';
import type { IAiClient } from '../../../src/ai/ai.interface';
import { mockBookmarkSelect } from '../../__mocks__/bookmark.mock';

describe('SearchService Unit Test', () => {
  let sut: SearchService;
  let aiClient: jest.Mocked<IAiClient>;
  let bookmarksRepository: jest.Mocked<BookmarksRepository>;

  const QUERY = 'how does Kafka handle message ordering';
  const EMBEDDING = new Array(768).fill(0.05);

  const BOOKMARKS = {
    'id-1': mockBookmarkSelect({ id: 'id-1', originalUrl: 'https://example.com/kafka-partitioning', contentSummary: 'Kafka partitioning and ordering guarantees.', tags: ['kafka', 'streaming'], status: 'COMPLETED' }),
    'id-2': mockBookmarkSelect({ id: 'id-2', originalUrl: 'https://example.com/kafka-consumers', contentSummary: 'Consumer group rebalancing in Apache Kafka.', tags: ['kafka', 'consumers'], status: 'COMPLETED' }),
    'id-3': mockBookmarkSelect({ id: 'id-3', originalUrl: 'https://example.com/event-streaming', contentSummary: 'Event streaming patterns for distributed systems.', tags: ['events', 'distributed'], status: 'COMPLETED' }),
  };

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(SearchService).compile();
    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
    bookmarksRepository = unitRef.get(BookmarksRepository);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given search, When called', () => {
    describe('And both vector and lexical results exist', () => {
      beforeEach(() => {
        aiClient.generateEmbedding.mockResolvedValue(EMBEDDING);

        bookmarksRepository.findSimilarIds.mockResolvedValue(['id-1', 'id-2', 'id-3']);
        bookmarksRepository.findByLexical.mockResolvedValue(['id-1', 'id-3']);
        bookmarksRepository.findByIds.mockResolvedValue([BOOKMARKS['id-1']!, BOOKMARKS['id-3']!, BOOKMARKS['id-2']!]);
      });

      test('Then it returns BookmarkSelect entities in RRF-fused order', async () => {
        const results = await sut.search(QUERY);

        expect(results.map((r) => r.id)).toEqual(['id-1', 'id-3', 'id-2']);
      });

      test('Then it embeds the query and queries both retrievers with CANDIDATE_K', async () => {
        await sut.search(QUERY);

        expect(aiClient.generateEmbedding).toHaveBeenCalledWith(QUERY);
        expect(bookmarksRepository.findSimilarIds).toHaveBeenCalledWith(EMBEDDING, 20);
        expect(bookmarksRepository.findByLexical).toHaveBeenCalledWith(QUERY, 20);
      });

      test('Then both retrievers run in parallel (called before findByIds)', async () => {
        await sut.search(QUERY);

        const similarCall = bookmarksRepository.findSimilarIds.mock.invocationCallOrder[0]!;
        const lexicalCall = bookmarksRepository.findByLexical.mock.invocationCallOrder[0]!;
        const byIdsCall = bookmarksRepository.findByIds.mock.invocationCallOrder[0]!;

        expect(similarCall).toBeLessThan(byIdsCall);
        expect(lexicalCall).toBeLessThan(byIdsCall);
      });
    });

    describe('And only vector results exist (no lexical matches)', () => {
      test('Then it still returns top 3 by vector rank alone', async () => {
        aiClient.generateEmbedding.mockResolvedValue(EMBEDDING);
        bookmarksRepository.findSimilarIds.mockResolvedValue(['id-1', 'id-2', 'id-3']);
        bookmarksRepository.findByLexical.mockResolvedValue([]);
        bookmarksRepository.findByIds.mockResolvedValue([BOOKMARKS['id-1']!, BOOKMARKS['id-2']!, BOOKMARKS['id-3']!]);

        const results = await sut.search(QUERY);

        expect(results.map((r) => r.id)).toEqual(['id-1', 'id-2', 'id-3']);
      });
    });

    describe('And neither retriever finds anything', () => {
      test('Then it returns an empty array without calling findByIds', async () => {
        aiClient.generateEmbedding.mockResolvedValue(EMBEDDING);
        bookmarksRepository.findSimilarIds.mockResolvedValue([]);
        bookmarksRepository.findByLexical.mockResolvedValue([]);

        const results = await sut.search(QUERY);

        expect(results).toEqual([]);
        expect(bookmarksRepository.findByIds).not.toHaveBeenCalled();
      });
    });
  });
});
