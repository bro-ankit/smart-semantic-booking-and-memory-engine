import { z } from 'zod';

export const BookmarkEnrichmentSchema = z.object({
  contentSummary: z
    .string()
    .min(10)
    .describe('A concise 2-3 sentence summary of the core concepts.'),
  tags: z
    .array(z.string())
    .max(5)
    .describe('Up to 5 highly relevant taxonomy tags.'),
  actionItems: z
    .array(z.string())
    .describe('Actionable todos or tasks explicitly mentioned or implied for engineering follow-up.'),
});

export type BookmarkEnrichment = z.infer<typeof BookmarkEnrichmentSchema>;
