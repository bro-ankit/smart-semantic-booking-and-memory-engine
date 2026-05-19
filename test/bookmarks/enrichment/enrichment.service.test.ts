import { HttpStatus } from '@nestjs/common';
import { TestBed } from '@automock/jest';
import { EnrichmentService } from '../../../src/bookmarks/enrichment/enrichment.service';
import type { BookmarkEnrichment } from '../../../src/bookmarks/enrichment/enrichment.zod';
import type { IAiClient } from '../../../src/ai/ai.interface';
import { AI_CLIENT } from '../../../src/ai/ai.constants';
import { AssertUtils } from '../../utils/assert.utils';

describe('EnrichmentService Unit Test', () => {
  let sut: EnrichmentService;
  let aiClient: jest.Mocked<IAiClient>;

  const INPUT_TEXT = 'Article about Kafka partitioning strategies for high-throughput systems';

  const VALID_ENRICHMENT: BookmarkEnrichment = {
    contentSummary: 'Kafka uses partitions to parallelize message consumption across consumer groups.',
    tags: ['kafka', 'distributed-systems', 'messaging', 'partitioning'],
    actionItems: ['Set up a Kafka cluster', 'Benchmark partition throughput'],
  };

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(EnrichmentService).compile();
    sut = unit;
    aiClient = unitRef.get<IAiClient>(AI_CLIENT);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given enrich, When called', () => {
    describe('And the AI client returns valid structured data', () => {
      test('Then it calls generateStructured with the enrichment prompt and schema', async () => {
        aiClient.generateStructured.mockResolvedValueOnce(VALID_ENRICHMENT);

        const result = await sut.enrich(INPUT_TEXT);

        expect(result).toEqual(VALID_ENRICHMENT);
        expect(aiClient.generateStructured).toHaveBeenCalledWith(
          `
You are a knowledge extraction assistant. Given the following raw text, extract structured metadata.

Raw Text:
---
${INPUT_TEXT}
---

Return a JSON object with:
- contentSummary: A concise 2-3 sentence summary of the core concepts.
- tags: Up to 5 highly relevant taxonomy tags (lowercase, no spaces).
- actionItems: Actionable todos or tasks explicitly mentioned or implied for engineering follow-up.
`,
          {
            type: 'object',
            properties: {
              contentSummary: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              actionItems: { type: 'array', items: { type: 'string' } },
            },
            required: ['contentSummary', 'tags', 'actionItems'],
          },
        );
      });
    });

    describe('And the AI client throws', () => {
      test('Then the error propagates without wrapping', async () => {
        const upstreamError = new Error('Network timeout');
        aiClient.generateStructured.mockRejectedValueOnce(upstreamError);

        await expect(sut.enrich(INPUT_TEXT)).rejects.toThrow('Network timeout');
      });
    });

    describe.each([
      {
        label: 'contentSummary is too short (under 10 chars)',
        payload: { contentSummary: 'short', tags: [], actionItems: [] },
      },
      {
        label: 'contentSummary is missing',
        payload: { tags: ['kafka'], actionItems: [] },
      },
      {
        label: 'tags exceeds max of 5',
        payload: {
          contentSummary: 'A valid two-three sentence summary of the content here.',
          tags: ['a', 'b', 'c', 'd', 'e', 'f'],
          actionItems: [],
        },
      },
      {
        label: 'actionItems is missing',
        payload: {
          contentSummary: 'A valid two-three sentence summary of the content here.',
          tags: ['kafka'],
        },
      },
    ])('And the AI client returns invalid data: $label', ({ payload }) => {
      test(`Then it throws 500 with message "${'AI response failed schema validation'}"`, async () => {
        aiClient.generateStructured.mockResolvedValueOnce(payload);

        await AssertUtils.assertError(
          () => sut.enrich(INPUT_TEXT),
          'AI response failed schema validation',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    });
  })
});
