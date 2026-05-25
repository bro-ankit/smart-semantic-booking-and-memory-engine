import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RAGService } from './rag.service';
import { AskQuestionDto } from '../dto/ask-question.dto';
import { AskResponseDto } from '../dto/ask-response.dto';

@ApiTags('ask')
@Controller('ask')
export class RAGController {
  constructor(private readonly ragService: RAGService) { }

  @Post()
  @ApiOperation({ summary: 'Ask a question — answered using only your saved bookmarks as context' })
  @ApiOkResponse({ type: AskResponseDto })
  ask(@Body() dto: AskQuestionDto): Promise<AskResponseDto> {
    return this.ragService.ask(dto.question);
  }
}
