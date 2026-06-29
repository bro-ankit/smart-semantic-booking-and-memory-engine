import { HttpStatus } from '@nestjs/common';
import { TestBed } from '@automock/jest';
import { AgentToolExecutorService } from '../../../src/agent/tools/agent-tool-executor.service';
import { SearchService } from '../../../src/bookmarks/search/search.service';
import { BookmarksRepository } from '../../../src/bookmarks/bookmarks.repository';
import { TodosRepository } from '../../../src/bookmarks/todos.repository';
import { AI_CLIENT } from '../../../src/ai/ai.constants';
import type { IAiClient } from '../../../src/ai/ai.interface';
import { AssertUtils } from '../../utils/assert.utils';
import { mockBookmarkSelect } from '../../__mocks__/bookmark.mock';

type SearchFoundResult = { found: number; bookmarks: Array<{ id: string; summary: string; tags: string[]; url: string }> };
type SearchEmptyResult = { found: number; message: string };
type CreateTodoResult = { created: boolean; todoId: string; task: string; bookmarkId: string };
type SummarizeTagResult = { found: number; tag: string; bookmarkIds: string[]; synthesis: string };

const BOOKMARK = mockBookmarkSelect({ id: 'bm-001', status: 'COMPLETED', tags: ['kafka'], contentSummary: 'Kafka partitioning guide.' });

describe('AgentToolExecutorService Unit Test', () => {
  let sut: AgentToolExecutorService;
  let searchService: jest.Mocked<SearchService>;
  let bookmarksRepository: jest.Mocked<BookmarksRepository>;
  let todosRepository: jest.Mocked<TodosRepository>;
  let aiClient: jest.Mocked<IAiClient>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(AgentToolExecutorService).compile();
    sut = unit;
    searchService = unitRef.get(SearchService);
    bookmarksRepository = unitRef.get(BookmarksRepository);
    todosRepository = unitRef.get(TodosRepository);
    aiClient = unitRef.get(AI_CLIENT);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given execute with searchBookmarks', () => {
    describe('When results are found', () => {
      test('Then it returns found count and bookmark summaries', async () => {
        searchService.search.mockResolvedValue([
          mockBookmarkSelect({ id: 'bm-001', contentSummary: 'Kafka partitioning guide.', tags: ['kafka'], originalUrl: 'https://kafka.apache.org', status: 'COMPLETED' }),
        ]);

        const result = await sut.execute('searchBookmarks', { query: 'kafka partitioning' }) as SearchFoundResult;

        expect(result.found).toBe(1);
        expect(result.bookmarks[0]).toEqual({ id: 'bm-001', summary: 'Kafka partitioning guide.', tags: ['kafka'], url: 'https://kafka.apache.org' });
        expect(searchService.search).toHaveBeenCalledWith('kafka partitioning');
      });
    });

    describe('When no results are found', () => {
      test('Then it returns found:0 with a descriptive message', async () => {
        searchService.search.mockResolvedValue([]);

        const result = await sut.execute('searchBookmarks', { query: 'unknown topic' }) as SearchEmptyResult;

        expect(result.found).toBe(0);
        expect(typeof result.message).toBe('string');
      });
    });
  });

  describe('Given execute with createTodo', () => {
    test('Then it inserts a todo and returns the created record', async () => {
      todosRepository.insert.mockResolvedValue({ id: 'todo-001', task: 'Read Kafka docs', bookmarkId: 'bm-001' });

      const result = await sut.execute('createTodo', { bookmarkId: 'bm-001', task: 'Read Kafka docs' }) as CreateTodoResult;

      expect(result).toEqual({ created: true, todoId: 'todo-001', task: 'Read Kafka docs', bookmarkId: 'bm-001' });
      expect(todosRepository.insert).toHaveBeenCalledWith({ bookmarkId: 'bm-001', task: 'Read Kafka docs' });
    });
  });

  describe('Given execute with summarizeTag', () => {
    describe('When bookmarks exist for the tag', () => {
      test('Then it returns the synthesis and bookmark ids', async () => {
        bookmarksRepository.findByTag.mockResolvedValue([BOOKMARK]);
        aiClient.generateText.mockResolvedValue('Kafka is a distributed log used for stream processing.');

        const result = await sut.execute('summarizeTag', { tag: 'kafka' }) as SummarizeTagResult;

        expect(result.found).toBe(1);
        expect(result.tag).toBe('kafka');
        expect(result.bookmarkIds).toEqual(['bm-001']);
        expect(result.synthesis).toBe('Kafka is a distributed log used for stream processing.');
      });
    });

    describe('When no bookmarks exist for the tag', () => {
      test('Then it returns found:0 with a descriptive message', async () => {
        bookmarksRepository.findByTag.mockResolvedValue([]);

        const result = await sut.execute('summarizeTag', { tag: 'unknown' }) as SearchEmptyResult;

        expect(result.found).toBe(0);
        expect(result.message).toContain('"unknown"');
      });
    });
  });

  describe('Given execute with an unknown tool name', () => {
    test('Then it throws 500', async () => {
      await AssertUtils.assertError(
        () => sut.execute('nonExistentTool', {}),
        'Agent called unknown tool: nonExistentTool',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });
});
