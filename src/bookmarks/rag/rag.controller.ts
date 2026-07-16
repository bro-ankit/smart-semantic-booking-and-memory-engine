import { Body, Controller, MessageEvent, Post, Sse } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { from, map, Observable } from 'rxjs';

import { AskQuestionDto } from '../dto/ask-question.dto';
import { AskResponseDto } from '../dto/ask-response.dto';
import { RAGService } from './rag.service';

@ApiTags('ask')
@Controller('ask')
export class RAGController {
  constructor(private readonly ragService: RAGService) {}

  @Post()
  @ApiOperation({ summary: 'Ask a question — answered using only your saved bookmarks as context' })
  @ApiOkResponse({ type: AskResponseDto })
  ask(@Body() dto: AskQuestionDto): Promise<AskResponseDto> {
    return this.ragService.ask(dto.question);
  }

  @Post('stream')
  @Sse()
  @ApiOperation({ summary: 'Ask a question — answer streamed token-by-token via SSE' })
  stream(@Body() dto: AskQuestionDto): Observable<MessageEvent> {
    return from(this.ragService.streamAnswer(dto.question)).pipe(
      map((token) => ({ data: token }) satisfies MessageEvent),
    );
  }
}
