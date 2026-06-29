import { TestBed } from '@automock/jest';
import { RunAgentCommandHandler } from '../../../src/agent/commands/run-agent.command-handler';
import { RunAgentCommand } from '../../../src/agent/commands/run-agent.command';
import { AgentToolExecutorService } from '../../../src/agent/tools/agent-tool-executor.service';
import { AI_CLIENT } from '../../../src/ai/ai.constants';
import type { IAiClient } from '../../../src/ai/ai.interface';

const QUESTION = 'What do I know about Kafka?';
const SEARCH_RESULT = { found: 1, bookmarks: [{ id: 'bm-001', summary: 'Kafka partitioning guide.', tags: ['kafka'], url: 'https://kafka.apache.org' }] };
const FINAL_ANSWER = 'Based on your bookmarks, Kafka uses partitions to achieve parallelism.';

describe('RunAgentCommandHandler Unit Test', () => {
  let sut: RunAgentCommandHandler;
  let aiClient: jest.Mocked<IAiClient>;
  let toolExecutor: jest.Mocked<AgentToolExecutorService>;

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(RunAgentCommandHandler).compile();
    sut = unit;
    aiClient = unitRef.get(AI_CLIENT);
    toolExecutor = unitRef.get(AgentToolExecutorService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given execute, When the agent resolves in one tool call + final answer', () => {
    test('Then it returns the answer, trace, and truncated:false', async () => {
      aiClient.generateWithTools
        .mockResolvedValueOnce({ type: 'tool_call', toolName: 'searchBookmarks', args: { query: 'Kafka' } })
        .mockResolvedValueOnce({ type: 'final_answer', text: FINAL_ANSWER });
      toolExecutor.execute.mockResolvedValue(SEARCH_RESULT);

      const result = await sut.execute(new RunAgentCommand(QUESTION));

      expect(result.answer).toBe(FINAL_ANSWER);
      expect(result.truncated).toBe(false);
      expect(result.toolCallTrace).toEqual([
        { iteration: 1, toolName: 'searchBookmarks', args: { query: 'Kafka' }, result: SEARCH_RESULT },
      ]);

      expect(aiClient.generateWithTools).toHaveBeenCalledTimes(2);
      expect(toolExecutor.execute).toHaveBeenCalledWith('searchBookmarks', { query: 'Kafka' });
    });
  });

  describe('Given execute, When the agent answers immediately without calling any tool', () => {
    test('Then it returns the answer with an empty trace and truncated:false', async () => {
      aiClient.generateWithTools.mockResolvedValue({ type: 'final_answer', text: FINAL_ANSWER });

      const result = await sut.execute(new RunAgentCommand(QUESTION));

      expect(result.answer).toBe(FINAL_ANSWER);
      expect(result.truncated).toBe(false);
      expect(result.toolCallTrace).toEqual([]);
      expect(toolExecutor.execute).not.toHaveBeenCalled();
    });
  });

  describe('Given execute, When a tool throws an error', () => {
    test('Then it reports the error to the agent and continues the loop', async () => {
      aiClient.generateWithTools
        .mockResolvedValueOnce({ type: 'tool_call', toolName: 'searchBookmarks', args: { query: 'Kafka' } })
        .mockResolvedValueOnce({ type: 'final_answer', text: 'I could not retrieve results due to an error.' });
      toolExecutor.execute.mockRejectedValue(new Error('DB connection lost'));

      const result = await sut.execute(new RunAgentCommand(QUESTION));

      expect(result.truncated).toBe(false);
      expect(result.toolCallTrace[0]?.result).toMatchObject({ error: true, message: expect.stringContaining('DB connection lost') });
    });
  });

  describe('Given execute, When the agent hits the max iteration limit', () => {
    test('Then it returns truncated:true with the last tool result as partial answer', async () => {
      aiClient.generateWithTools.mockResolvedValue({ type: 'tool_call', toolName: 'searchBookmarks', args: { query: 'Kafka' } });
      toolExecutor.execute.mockResolvedValue(SEARCH_RESULT);

      const result = await sut.execute(new RunAgentCommand(QUESTION));

      expect(result.truncated).toBe(true);
      expect(result.toolCallTrace).toHaveLength(5);
      expect(aiClient.generateWithTools).toHaveBeenCalledTimes(5);
    });
  });
});
