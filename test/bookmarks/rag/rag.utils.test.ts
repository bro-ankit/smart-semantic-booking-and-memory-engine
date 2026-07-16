import type { SearchResultDto } from '../../../src/bookmarks/dto/search-result.dto';
import { RagUtils } from '../../../src/bookmarks/rag/rag.utils';

describe('RagUtils Unit Test', () => {
  const BOOKMARK_1: SearchResultDto = {
    id: 'id-1',
    originalUrl: 'https://example.com/kafka-ordering',
    contentSummary: 'Kafka guarantees ordering within a partition via sequential offsets.',
    tags: ['kafka', 'ordering'],
    status: 'COMPLETED',
    createdAt: new Date('2026-05-21T00:00:00Z'),
  };

  const BOOKMARK_2: SearchResultDto = {
    id: 'id-2',
    originalUrl: 'https://example.com/kafka-partitions',
    contentSummary: 'Partitions are the unit of parallelism in Kafka.',
    tags: ['kafka', 'partitions', 'distributed'],
    status: 'COMPLETED',
    createdAt: new Date('2026-05-21T01:00:00Z'),
  };

  const EMPTY_CONTEXT_PROMPT =
    'You are a helpful assistant.\n' +
    'If you cannot answer from the provided context, respond with: "I don\'t have enough context in my bookmarks to answer this. Try ingesting relevant content first."\n' +
    '\n' +
    'Context: (no bookmarks found)';

  const SINGLE_BOOKMARK_PROMPT =
    "You are a helpful assistant. Answer the user's question using ONLY the following bookmarked content.\n" +
    'If the answer cannot be found in the provided context, respond with: "I don\'t have enough context in my bookmarks to answer this. Try ingesting relevant content first."\n' +
    '\n' +
    'Context:\n' +
    '**Bookmark 1**\n' +
    'URL: https://example.com/kafka-ordering\n' +
    'Summary: Kafka guarantees ordering within a partition via sequential offsets.\n' +
    'Tags: kafka, ordering';

  const TWO_BOOKMARK_PROMPT =
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
    'Tags: kafka, partitions, distributed';

  const SINGLE_TAG_PROMPT =
    "You are a helpful assistant. Answer the user's question using ONLY the following bookmarked content.\n" +
    'If the answer cannot be found in the provided context, respond with: "I don\'t have enough context in my bookmarks to answer this. Try ingesting relevant content first."\n' +
    '\n' +
    'Context:\n' +
    '**Bookmark 1**\n' +
    'URL: https://example.com/kafka-ordering\n' +
    'Summary: Kafka guarantees ordering within a partition via sequential offsets.\n' +
    'Tags: kafka';

  describe('Given buildSystemPrompt, When called', () => {
    describe('And results array is empty', () => {
      test('Then it returns the no-context fallback prompt verbatim', () => {
        const prompt = RagUtils.buildSystemPrompt([]);

        expect(prompt).toBe(EMPTY_CONTEXT_PROMPT);
      });
    });

    describe('And results contain a single bookmark', () => {
      test('Then it returns the full context prompt with Bookmark 1 block', () => {
        const prompt = RagUtils.buildSystemPrompt([BOOKMARK_1]);

        expect(prompt).toBe(SINGLE_BOOKMARK_PROMPT);
      });
    });

    describe('And results contain multiple bookmarks', () => {
      test('Then it returns the full context prompt with both numbered bookmark blocks', () => {
        const prompt = RagUtils.buildSystemPrompt([BOOKMARK_1, BOOKMARK_2]);

        expect(prompt).toBe(TWO_BOOKMARK_PROMPT);
      });
    });

    describe('And a bookmark has a single tag', () => {
      test('Then the Tags line contains no trailing comma', () => {
        const singleTagBookmark: SearchResultDto = { ...BOOKMARK_1, tags: ['kafka'] };

        const prompt = RagUtils.buildSystemPrompt([singleTagBookmark]);

        expect(prompt).toBe(SINGLE_TAG_PROMPT);
      });
    });
  });
});
