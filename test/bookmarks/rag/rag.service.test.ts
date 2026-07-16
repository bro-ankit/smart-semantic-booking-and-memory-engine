import { TestBed } from '@automock/jest';
import { HttpStatus, InternalServerErrorException } from '@nestjs/common';

import { AI_CLIENT } from '../../../src/ai/ai.constants';
import type { IAiClient } from '../../../src/ai/ai.interface';
import { RAGService } from '../../../src/bookmarks/rag/rag.service';
import { SearchService } from '../../../src/bookmarks/search/search.service';
import { AiUsageContextService } from '../../../src/metrics/ai-usage-context.service';
import { mockBookmarkSelect } from '../../__mocks__/bookmark.mock';
import { AssertUtils } from '../../utils/assert.utils';

describe('RAGService Unit Test', () => {
  let sut: RAGService;
  let searchService: jest.Mocked<SearchService>;
  let aiClient: jest.Mocked<IAiClient>;
  let usageContext: jest.Mocked<AiUsageContextService>;

  const QUESTION = 'How does Kafka handle message ordering across partitions?';
  const LLM_ANSWER = 'Kafka preserves order within a single partition using sequential offsets.';
  const NO_CONTEXT_LLM_ANSWER =
    "I don't have enough context in my bookmarks to answer this. Try ingesting relevant content first.";

  const CONTEXT_RESULTS = [
    mockBookmarkSelect({
      id: 'id-1',
      originalUrl: 'https://example.com/kafka-ordering',
      contentSummary: 'Kafka guarantees ordering within a partition via sequential offsets.',
      tags: ['kafka', 'ordering'],
      status: 'COMPLETED',
      createdAt: new Date('2026-05-21T00:00:00Z'),
    }),
    mockBookmarkSelect({
      id: 'id-2',
      originalUrl: 'https://example.com/kafka-partitions',
      contentSummary: 'Partitions are the unit of parallelism in Kafka.',
      tags: ['kafka', 'partitions'],
      status: 'COMPLETED',
      createdAt: new Date('2026-05-21T01:00:00Z'),
    }),
  ];

  const CONTEXT_SYSTEM_PROMPT =
    "You are a helpful assistant. Answer the user's question using ONLY the following bookmarked content.\n" +
    'If the answer cannot be found in the provided context, respond with: "I don\'t have enough context in my bookmarks to answer this. Try ingesting relevant content first."\n' +
    '\n' +
    'Context:\n' +
    '**Bookmark 1**\n' +
    'URL: https://example.com/kafka-ordering\n' +
    'Summary: Kafka guarantees ordering within a partition via sequential offsets.\n' +
    'Tags: kafka, ordering\n' +
    '\n' +
    '**Bookmark 2**\n' +
    'URL: https://example.com/kafka-partitions\n' +
    'Summary: Partitions are the unit of parallelism in Kafka.\n' +
    'Tags: kafka, partitions';

  const EMPTY_CONTEXT_SYSTEM_PROMPT =
    'You are a helpful assistant.\n' +
    'If you cannot answer from the provided context, respond with: "I don\'t have enough context in my bookmarks to answer this. Try ingesting relevant content first."\n' +
    '\n' +
    'Context: (no bookmarks found)';

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(RAGService).compile();
    sut = unit;
    searchService = unitRef.get(SearchService);
    aiClient = unitRef.get(AI_CLIENT);
    usageContext = unitRef.get(AiUsageContextService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usageContext.runIterable.mockImplementation(async function* (_store, source) {
      yield* source;
    });
  });

  describe('Given ask, When called', () => {
    describe('And matching bookmarks are found', () => {
      beforeEach(() => {
        searchService.search.mockResolvedValue(CONTEXT_RESULTS);
        aiClient.generateText.mockResolvedValue(LLM_ANSWER);
      });

      test('Then it returns an AskResponseDto with the LLM answer', async () => {
        const result = await sut.ask(QUESTION);

        expect(result).toEqual({ answer: LLM_ANSWER });
      });

      test('Then it searches with the user question', async () => {
        await sut.ask(QUESTION);

        expect(searchService.search).toHaveBeenCalledWith(QUESTION);
      });

      test('Then it passes the full context system prompt and the question verbatim to the LLM', async () => {
        await sut.ask(QUESTION);

        const [systemPrompt, userMessage] = aiClient.generateText.mock.calls[0]!;

        expect(systemPrompt).toBe(CONTEXT_SYSTEM_PROMPT);
        expect(userMessage).toBe(QUESTION);
      });
    });

    describe('And no bookmarks are found', () => {
      test('Then it calls the LLM with the empty-context system prompt and returns the response', async () => {
        searchService.search.mockResolvedValue([]);
        aiClient.generateText.mockResolvedValue(NO_CONTEXT_LLM_ANSWER);

        const result = await sut.ask(QUESTION);

        const [systemPrompt] = aiClient.generateText.mock.calls[0]!;
        expect(systemPrompt).toBe(EMPTY_CONTEXT_SYSTEM_PROMPT);
        expect(result).toEqual({ answer: NO_CONTEXT_LLM_ANSWER });
      });
    });

    describe('And the LLM call fails', () => {
      test('Then it propagates the exception', async () => {
        searchService.search.mockResolvedValue(CONTEXT_RESULTS);
        aiClient.generateText.mockRejectedValueOnce(new InternalServerErrorException('Gemini API call failed'));

        await AssertUtils.assertError(
          () => sut.ask(QUESTION),
          'Gemini API call failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    });

    describe('And the search call fails', () => {
      test('Then it propagates the exception before reaching the LLM', async () => {
        searchService.search.mockRejectedValueOnce(new InternalServerErrorException('Embedding generation failed'));

        await AssertUtils.assertError(
          () => sut.ask(QUESTION),
          'Embedding generation failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );

        expect(aiClient.generateText).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given streamAnswer, When called', () => {
    test('Then it searches for context and streams chunks from generateTextStream tagged as RAG_ASK', async () => {
      searchService.search.mockResolvedValue(CONTEXT_RESULTS);
      aiClient.generateTextStream.mockReturnValue(
        (async function* () {
          yield 'Kafka ';
          yield 'preserves order.';
        })(),
      );

      const chunks: string[] = [];
      for await (const chunk of sut.streamAnswer(QUESTION)) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Kafka ', 'preserves order.']);
      expect(searchService.search).toHaveBeenCalledWith(QUESTION);
      expect(aiClient.generateTextStream).toHaveBeenCalledWith(CONTEXT_SYSTEM_PROMPT, QUESTION);
      expect(usageContext.runIterable).toHaveBeenCalledWith({ operation: 'RAG_ASK' }, expect.anything());
    });
  });
});
