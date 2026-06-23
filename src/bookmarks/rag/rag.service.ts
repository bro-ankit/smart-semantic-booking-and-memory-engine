import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { plainToInstance } from 'class-transformer';
import { AI_CLIENT } from '../../ai/ai.constants';
import type { IAiClient } from '../../ai/ai.interface';
import { SearchService } from '../search/search.service';
import { RagUtils } from './rag.utils';
import { AskResponseDto } from '../dto/ask-response.dto';

type RagExecuteResult = {
  answer: string;
  contextChunks: string[];
};

@Injectable()
export class RAGService {
  constructor(
    @InjectPinoLogger(RAGService.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    private readonly searchService: SearchService,
  ) {}

  async ask(question: string): Promise<AskResponseDto> {
    this.logger.info({ question }, 'RAG ask request');
    const { answer } = await this.execute(question);
    return plainToInstance(AskResponseDto, { answer }, { excludeExtraneousValues: true });
  }

  async execute(question: string): Promise<RagExecuteResult> {
    const contextResults = await this.searchService.search(question);
    this.logger.debug({ contextCount: contextResults.length }, 'Context retrieved');
    const answer = await this.aiClient.generateText(RagUtils.buildSystemPrompt(contextResults), question);
    const contextChunks = contextResults.map((r) => `[${r.originalUrl}] ${r.contentSummary}`);
    return { answer, contextChunks };
  }
}
