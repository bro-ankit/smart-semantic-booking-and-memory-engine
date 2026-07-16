import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RunAgentCommand } from './commands/run-agent.command';
import { RunAgentRequestDto } from './dto/run-agent-request.dto';
import { RunAgentResponseDto } from './dto/run-agent-response.dto';

@ApiTags('agent')
@Controller('agent')
export class AgentController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('run')
  @ApiOperation({ summary: 'Run the agentic tool-use loop against the knowledge base' })
  @ApiCreatedResponse({ type: RunAgentResponseDto })
  run(@Body() dto: RunAgentRequestDto): Promise<RunAgentResponseDto> {
    return this.commandBus.execute(new RunAgentCommand(dto.question));
  }
}
