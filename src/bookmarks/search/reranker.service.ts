import type { PreTrainedModel, PreTrainedTokenizer } from '@huggingface/transformers';
import { AutoModelForSequenceClassification, AutoTokenizer } from '@huggingface/transformers';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { ENV_VARIABLES } from '../../constants/env.constants';
import { RERANKER_DEFAULTS } from './reranker.constants';

export type RerankCandidate = { id: string; text: string };
export type RerankResult = { id: string; score: number };

@Injectable()
export class RerankerService implements OnModuleInit {
  private readonly modelId: string;
  private tokenizer!: PreTrainedTokenizer;
  private model!: PreTrainedModel;

  constructor(
    @InjectPinoLogger(RerankerService.name) private readonly logger: PinoLogger,
    private readonly config: ConfigService,
  ) {
    this.modelId = this.config.get<string>(ENV_VARIABLES.RERANKER.MODEL, RERANKER_DEFAULTS.MODEL);
  }

  async onModuleInit() {
    this.logger.info({ modelId: this.modelId }, 'Loading cross-encoder reranker model');
    this.tokenizer = await AutoTokenizer.from_pretrained(this.modelId);
    this.model = await AutoModelForSequenceClassification.from_pretrained(this.modelId);
    this.logger.info({ modelId: this.modelId }, 'Cross-encoder reranker model ready');
  }

  async rerank(query: string, candidates: RerankCandidate[]): Promise<RerankResult[]> {
    const scores = await Promise.all(candidates.map((c) => this.score(query, c)));

    return scores.sort((a, b) => b.score - a.score);
  }

  private async score(query: string, candidate: RerankCandidate): Promise<RerankResult> {
    const inputs = this.tokenizer(query, { text_pair: candidate.text, padding: true, truncation: true });
    const { logits } = await this.model(inputs);

    return { id: candidate.id, score: logits.data[0] as number };
  }
}
