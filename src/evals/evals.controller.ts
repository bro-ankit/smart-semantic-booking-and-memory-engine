import { Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RunEvalsCommand } from './commands/run-evals.command';
import { RunEvalsResponseDto } from './dto/run-evals-response.dto';

@ApiTags('evals')
@Controller('evals')
export class EvalsController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('run')
  @ApiOperation({ summary: 'Run the full eval suite against the golden dataset and return a quality report' })
  @ApiCreatedResponse({ type: RunEvalsResponseDto })
  run(): Promise<RunEvalsResponseDto> {
    return this.commandBus.execute(new RunEvalsCommand());
  }
}
