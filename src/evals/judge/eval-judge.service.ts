import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { z } from 'zod';
import { AI_CLIENT } from '../../ai/ai.constants';
import type { IAiClient, AiResponseSchema } from '../../ai/ai.interface';
import type { EvalJudgeInput, EvalJudgeResult } from '../evals.types';
import { TrackAiUsage } from '../../metrics/track-ai-usage.decorator';

const JUDGE_AI_SCHEMA: AiResponseSchema = {
  type: 'object',
  properties: {
    relevance: { type: 'number' },
    faithfulness: { type: 'number' },
    reasoning: { type: 'string' },
  },
  required: ['relevance', 'faithfulness', 'reasoning'],
};

const EvalJudgeResultSchema = z.object({
  relevance: z.number().min(0).max(1),
  faithfulness: z.number().min(0).max(1),
  reasoning: z.string(),
});

@Injectable()
export class EvalJudgeService {
  constructor(
    @InjectPinoLogger(EvalJudgeService.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
  ) {}

  @TrackAiUsage('EVAL_JUDGE')
  async score(input: EvalJudgeInput): Promise<EvalJudgeResult> {
    const prompt = this.buildJudgePrompt(input);
    this.logger.debug({ question: input.question }, 'Scoring eval case with LLM judge');

    const raw = await this.aiClient.generateStructured(prompt, JUDGE_AI_SCHEMA);

    const parsed = EvalJudgeResultSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.error({ issues: parsed.error.issues, raw }, 'Judge returned invalid schema');
      throw new InternalServerErrorException('Eval judge returned an invalid scoring schema');
    }

    return parsed.data;
  }

  private buildJudgePrompt(input: EvalJudgeInput): string {
    const context = input.contextChunks.length > 0
      ? input.contextChunks.join('\n---\n')
      : '(no context retrieved from vector store)';

    return [
      'You are an expert AI system evaluator judging answers from a RAG (Retrieval-Augmented Generation) system.',
      '',
      `QUESTION: ${input.question}`,
      '',
      'EXPECTED TOPICS (a good answer should address most of these):',
      ...input.expectedTopics.map((t) => `- ${t}`),
      '',
      'RETRIEVED CONTEXT USED TO GENERATE THE ANSWER:',
      context,
      '',
      'ANSWER GIVEN BY THE RAG SYSTEM:',
      input.answer,
      '',
      'Score this answer on two dimensions:',
      '- relevance (0.0–1.0): Does the answer directly address the question and cover the expected topics?',
      '- faithfulness (0.0–1.0): Is every factual claim grounded in the provided context? 1.0 = no hallucinations, 0.0 = entirely invented.',
      '',
      'Return strict JSON only.',
    ].join('\n');
  }
}
