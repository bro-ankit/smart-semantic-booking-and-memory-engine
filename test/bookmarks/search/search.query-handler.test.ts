import { TestBed } from '@automock/jest';

import { SearchQuery } from '../../../src/bookmarks/search/search.query';
import { SearchQueryHandler } from '../../../src/bookmarks/search/search.query-handler';
import { SearchService } from '../../../src/bookmarks/search/search.service';
import { mockBookmarkSelect } from '../../__mocks__/bookmark.mock';

describe('SearchQueryHandler Unit Test', () => {
  let sut: SearchQueryHandler;
  let searchService: jest.Mocked<SearchService>;

  const BOOKMARK = mockBookmarkSelect({
    id: 'id-1',
    originalUrl: 'https://example.com/kafka',
    contentSummary: 'Kafka partitioning guide.',
    tags: ['kafka'],
    status: 'COMPLETED',
    createdAt: new Date('2026-05-20T00:00:00Z'),
  });

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(SearchQueryHandler).compile();
    sut = unit;
    searchService = unitRef.get(SearchService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given execute, When bookmarks are found', () => {
    test('Then it returns SearchResultDtos mapped from entities — embedding and tsvContent excluded', async () => {
      searchService.search.mockResolvedValue([BOOKMARK]);

      const results = await sut.execute(new SearchQuery('kafka'));

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'id-1',
        originalUrl: 'https://example.com/kafka',
        contentSummary: 'Kafka partitioning guide.',
        tags: ['kafka'],
        status: 'COMPLETED',
      });
      expect(results[0]).not.toHaveProperty('embedding');
      expect(results[0]).not.toHaveProperty('tsvContent');
    });

    test('Then it delegates the query string to SearchService', async () => {
      searchService.search.mockResolvedValue([BOOKMARK]);

      await sut.execute(new SearchQuery('kafka partitioning'));

      expect(searchService.search).toHaveBeenCalledWith('kafka partitioning');
    });
  });

  describe('Given execute, When no bookmarks are found', () => {
    test('Then it returns an empty array', async () => {
      searchService.search.mockResolvedValue([]);

      const results = await sut.execute(new SearchQuery('unknown topic'));

      expect(results).toEqual([]);
    });
  });
});
