import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { plainToInstance } from 'class-transformer';
import { RunAgentCommand } from './run-agent.command';
import { AgentToolExecutorService } from '../tools/agent-tool-executor.service';
import { RunAgentResponseDto } from '../dto/run-agent-response.dto';
import { AGENT_MAX_ITERATIONS } from '../agent.constants';
import { AGENT_TOOLS } from '../tools/agent-tools.definitions';
import { AI_CLIENT } from '../../ai/ai.constants';
import type { IAiClient, AgentMessage } from '../../ai/ai.interface';
import type { ToolCallTrace } from '../agent.types';

const DTO_OPTIONS = { excludeExtraneousValues: true } as const;

const SYSTEM_PROMPT = `You are a helpful assistant with access to the user's personal knowledge base of saved bookmarks.
Use the available tools to search, synthesise, and act on that knowledge.
Always search before answering — do not rely on general knowledge when bookmarks may contain relevant information.
If no relevant bookmarks exist, say so clearly rather than making up an answer.`;

@CommandHandler(RunAgentCommand)
export class RunAgentCommandHandler implements ICommandHandler<RunAgentCommand, RunAgentResponseDto> {
  constructor(
    @InjectPinoLogger(RunAgentCommandHandler.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    private readonly toolExecutor: AgentToolExecutorService,
  ) { }

  async execute(command: RunAgentCommand): Promise<RunAgentResponseDto> {
    const { question } = command;
    this.logger.info({ question }, 'Starting agent run');

    const history: AgentMessage[] = [
      { role: 'user', text: `${SYSTEM_PROMPT}\n\nUser question: ${question}` },
    ];
    const trace: ToolCallTrace[] = [];

    for (let iteration = 1; iteration <= AGENT_MAX_ITERATIONS; iteration++) {
      this.logger.debug({ iteration }, 'Agent iteration');

      const turn = await this.aiClient.generateWithTools(history, AGENT_TOOLS);

      if (turn.type === 'final_answer') {
        this.logger.info({ iterations: iteration, traceLength: trace.length }, 'Agent reached final answer');
        return plainToInstance(RunAgentResponseDto, { answer: turn.text, truncated: false, toolCallTrace: trace }, DTO_OPTIONS);
      }

      const { toolName, args } = turn;
      this.logger.info({ iteration, toolName, args }, 'Agent tool call');

      let result: unknown;
      try {
        result = await this.toolExecutor.execute(toolName, args);
      } catch (err) {
        this.logger.error({ err, toolName }, 'Tool execution failed — reporting error to agent');
        result = { error: true, message: `Tool "${toolName}" failed: ${(err as Error).message}` };
      }

      trace.push({ iteration, toolName, args, result });

      history.push({ role: 'tool_call', toolName, args });
      history.push({ role: 'tool_result', toolName, result });
    }

    this.logger.warn({ maxIterations: AGENT_MAX_ITERATIONS }, 'Agent hit max iterations — returning partial result');
    const partialAnswer = trace.length > 0
      ? `I was not able to complete the full reasoning within the iteration limit. Here is what I found so far: ${JSON.stringify(trace[trace.length - 1]?.result)}`
      : 'The agent could not produce an answer within the allowed number of steps.';

    return plainToInstance(RunAgentResponseDto, { answer: partialAnswer, truncated: true, toolCallTrace: trace }, DTO_OPTIONS);
  }
}
