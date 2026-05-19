import { BookmarkEnrichmentSchema } from '../../../src/bookmarks/enrichment/enrichment.zod';

const VALID_BASE = {
  contentSummary: 'Kafka uses partitions to parallelize consumption across consumer groups.',
  tags: ['kafka', 'messaging'],
  actionItems: ['Benchmark partition throughput'],
};

describe('Given BookmarkEnrichmentSchema, When parsed', () => {
  describe.each([
    {
      label: 'fully valid input',
      input: VALID_BASE,
      expected: VALID_BASE,
    },
    {
      label: 'empty tags and actionItems arrays',
      input: { ...VALID_BASE, tags: [], actionItems: [] },
      expected: { ...VALID_BASE, tags: [], actionItems: [] },
    },
    {
      label: 'exactly 5 tags (upper boundary)',
      input: { ...VALID_BASE, tags: ['a', 'b', 'c', 'd', 'e'] },
      expected: { ...VALID_BASE, tags: ['a', 'b', 'c', 'd', 'e'] },
    },
    {
      label: 'contentSummary of exactly 10 characters (lower boundary)',
      input: { ...VALID_BASE, contentSummary: '0123456789' },
      expected: { ...VALID_BASE, contentSummary: '0123456789' },
    },
  ])('And input is valid: $label', ({ input, expected }) => {
    test('Then it parses successfully and returns the data', () => {
      const result = BookmarkEnrichmentSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toEqual(expected);
    });
  });

  describe.each([
    {
      label: 'contentSummary is missing',
      input: { tags: ['kafka'], actionItems: [] },
    },
    {
      label: 'contentSummary is under 10 chars',
      input: { ...VALID_BASE, contentSummary: 'short' },
    },
    {
      label: 'contentSummary is empty string',
      input: { ...VALID_BASE, contentSummary: '' },
    },
    {
      label: 'tags exceeds max of 5',
      input: { ...VALID_BASE, tags: ['a', 'b', 'c', 'd', 'e', 'f'] },
    },
    {
      label: 'tags is not an array',
      input: { ...VALID_BASE, tags: 'kafka' },
    },
    {
      label: 'actionItems is missing',
      input: { contentSummary: VALID_BASE.contentSummary, tags: [] },
    },
    {
      label: 'actionItems contains a non-string element',
      input: { ...VALID_BASE, actionItems: [42] },
    },
  ])('And input is invalid: $label', ({ input }) => {
    test('Then safeParse returns success: false', () => {
      const result = BookmarkEnrichmentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});
