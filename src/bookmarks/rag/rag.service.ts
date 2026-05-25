import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AI_CLIENT } from '../../ai/ai.constants';
import type { IAiClient } from '../../ai/ai.interface';
import { SearchService } from '../search/search.service';
import { RagUtils } from './rag.utils';
import { plainToInstance } from 'class-transformer';
import { AskResponseDto } from '../dto/ask-response.dto';

@Injectable()
export class RAGService {
  constructor(
    @InjectPinoLogger(RAGService.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    private readonly searchService: SearchService,
  ) { }

  async ask(question: string) {
    this.logger.info({ question }, 'RAG ask request');

    const contextResults = await this.searchService.search(question);

    this.logger.debug({ contextCount: contextResults.length }, 'Context retrieved');

    const answer = await this.aiClient.generateText(RagUtils.buildSystemPrompt(contextResults), question);

    return plainToInstance(AskResponseDto, { answer }, { excludeExtraneousValues: true })
  }
}
