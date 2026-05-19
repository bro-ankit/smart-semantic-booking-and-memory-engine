import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AI_CLIENT } from '../../ai/ai.constants';
import type { IAiClient, AiResponseSchema } from '../../ai/ai.interface';
import { BookmarkEnrichmentSchema, type BookmarkEnrichment } from './enrichment.zod';
import { ENRICHMENT_ERRORS } from './enrichment.constants';

const ENRICHMENT_RESPONSE_SCHEMA: AiResponseSchema = {
  type: 'object',
  properties: {
    contentSummary: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    actionItems: { type: 'array', items: { type: 'string' } },
  },
  required: ['contentSummary', 'tags', 'actionItems'],
};

const buildPrompt = (text: string): string => `
You are a knowledge extraction assistant. Given the following raw text, extract structured metadata.

Raw Text:
---
${text}
---

Return a JSON object with:
- contentSummary: A concise 2-3 sentence summary of the core concepts.
- tags: Up to 5 highly relevant taxonomy tags (lowercase, no spaces).
- actionItems: Actionable todos or tasks explicitly mentioned or implied for engineering follow-up.
`;

@Injectable()
export class EnrichmentService {
  constructor(
    @InjectPinoLogger(EnrichmentService.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
  ) { }

  async enrich(text: string): Promise<BookmarkEnrichment> {
    this.logger.debug({ textLength: text.length }, 'Starting enrichment');

    const raw = await this.aiClient.generateStructured(buildPrompt(text), ENRICHMENT_RESPONSE_SCHEMA);

    const validated = BookmarkEnrichmentSchema.safeParse(raw);

    if (!validated.success) {
      this.logger.error({ issues: validated.error.issues }, ENRICHMENT_ERRORS.SCHEMA_VALIDATION_FAILED);
      throw new InternalServerErrorException(ENRICHMENT_ERRORS.SCHEMA_VALIDATION_FAILED);
    }

    this.logger.debug('Enrichment completed successfully');
    return validated.data;
  }
}
