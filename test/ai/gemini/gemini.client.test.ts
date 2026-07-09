import { HttpStatus } from '@nestjs/common';
import { TestBed } from '@automock/jest';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { GeminiClient } from '../../../src/ai/gemini/gemini.client';
import { GEMINI_CLIENT } from '../../../src/ai/gemini/gemini.constants';
import type { AiResponseSchema, AgentMessage, AgentTool } from '../../../src/ai/ai.interface';
import { AssertUtils } from '../../utils/assert.utils';
import { MetricsReporter } from '../../../src/metrics/metrics.reporter';
import { AiUsageContextService } from '../../../src/metrics/ai-usage-context.service';

const PROMPT = 'Extract structured data from this text about Kafka partitioning.';
const SAMPLE_TEXT = 'NestJS dependency injection patterns for scalable services';
const SYSTEM_PROMPT = 'Answer only from the provided context.';
const USER_MESSAGE = 'How does Kafka handle message ordering?';
const LLM_ANSWER = 'Kafka preserves order within a partition.';

const AGENT_HISTORY: AgentMessage[] = [
  { role: 'user', text: 'What do I know about Kafka?' },
];
const AGENT_TOOLS: AgentTool[] = [
  {
    name: 'searchBookmarks',
    description: 'Search saved bookmarks semantically.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
];

const INPUT_SCHEMA: AiResponseSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'tags'],
};

const EXPECTED_GEMINI_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['title', 'tags'],
};

const PARSED_RESPONSE = { title: 'Kafka Partitioning', tags: ['kafka', 'streaming'] };
const SAMPLE_EMBEDDING = [0.1, 0.2, 0.3, 0.4];

describe('GeminiClient Unit Test', () => {
  let sut: GeminiClient;
  let geminiClient: jest.Mocked<GoogleGenerativeAI>;
  let metricsReporter: jest.Mocked<MetricsReporter>;
  let usageContext: jest.Mocked<AiUsageContextService>;

  const mockGenerateContent = jest.fn();
  const mockEmbedContent = jest.fn();
  const mockSendMessage = jest.fn();
  const mockStartChat = jest.fn(() => ({ sendMessage: mockSendMessage }));
  const mockGenerateContentStream = jest.fn();

  const asyncIterableOf = <T>(items: T[]): AsyncIterable<T> => ({
    [Symbol.asyncIterator]: async function* () {
      for (const item of items) yield item;
    },
  });

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(GeminiClient).compile();
    sut = unit;
    geminiClient = unitRef.get<GoogleGenerativeAI>(GEMINI_CLIENT);
    metricsReporter = unitRef.get(MetricsReporter);
    usageContext = unitRef.get(AiUsageContextService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    geminiClient.getGenerativeModel.mockReturnValue({
      generateContent: mockGenerateContent,
      embedContent: mockEmbedContent,
      startChat: mockStartChat,
      generateContentStream: mockGenerateContentStream,
    } as never);
    usageContext.getOperation.mockReturnValue(undefined);
  });

  describe('Given generateStructured, When called', () => {
    describe('And Gemini returns valid JSON', () => {
      test('Then it calls the model with the mapped schema and returns the parsed object', async () => {
        mockGenerateContent.mockResolvedValueOnce({
          response: { text: () => JSON.stringify(PARSED_RESPONSE) },
        });

        const result = await sut.generateStructured(PROMPT, INPUT_SCHEMA);

        expect(result).toEqual(PARSED_RESPONSE);
        expect(geminiClient.getGenerativeModel).toHaveBeenCalledWith({
          model: 'gemini-2.5-flash',
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: EXPECTED_GEMINI_SCHEMA,
          },
        });
        expect(mockGenerateContent).toHaveBeenCalledWith(PROMPT);
      });
    });

    describe('And the Gemini API call throws', () => {
      test('Then it throws 500 with "Gemini API call failed"', async () => {
        mockGenerateContent.mockRejectedValueOnce(new Error('Connection timeout'));

        await AssertUtils.assertError(
          () => sut.generateStructured(PROMPT, INPUT_SCHEMA),
          'Gemini API call failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    });

    describe('And Gemini returns a non-JSON string', () => {
      test('Then it throws 500 with "Gemini returned non-JSON response"', async () => {
        mockGenerateContent.mockResolvedValueOnce({
          response: { text: () => 'not valid json {{' },
        });

        await AssertUtils.assertError(
          () => sut.generateStructured(PROMPT, INPUT_SCHEMA),
          'Gemini returned non-JSON response',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    });
  });

  describe('Given generateText, When called', () => {
    describe('And Gemini returns a response', () => {
      test('Then it calls the model with the system instruction and returns the raw text answer', async () => {
        mockGenerateContent.mockResolvedValueOnce({
          response: { text: () => LLM_ANSWER },
        });

        const result = await sut.generateText(SYSTEM_PROMPT, USER_MESSAGE);

        expect(result).toBe(LLM_ANSWER);
        expect(geminiClient.getGenerativeModel).toHaveBeenCalledWith({
          model: 'gemini-2.5-flash',
          systemInstruction: SYSTEM_PROMPT,
        });
        expect(mockGenerateContent).toHaveBeenCalledWith(USER_MESSAGE);
      });
    });

    describe('And the Gemini API call throws', () => {
      test('Then it throws 500 with "Gemini API call failed"', async () => {
        mockGenerateContent.mockRejectedValueOnce(new Error('rate limit exceeded'));

        await AssertUtils.assertError(
          () => sut.generateText(SYSTEM_PROMPT, USER_MESSAGE),
          'Gemini API call failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    });
  });

  describe('Given generateEmbedding, When called', () => {
    describe('And embedContent succeeds', () => {
      test('Then it calls gemini-embedding-001 with structured content and returns the values', async () => {
        mockEmbedContent.mockResolvedValueOnce({ embedding: { values: SAMPLE_EMBEDDING } });

        const result = await sut.generateEmbedding(SAMPLE_TEXT);

        expect(result).toEqual(SAMPLE_EMBEDDING);
        expect(geminiClient.getGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-embedding-001' });
        expect(mockEmbedContent).toHaveBeenCalledWith({
          content: { role: 'user', parts: [{ text: SAMPLE_TEXT }] },
          outputDimensionality: 768,
        });
      });
    });

    describe('And embedContent throws', () => {
      test('Then it throws 500 with "Gemini API call failed"', async () => {
        mockEmbedContent.mockRejectedValueOnce(new Error('network timeout'));

        await AssertUtils.assertError(
          () => sut.generateEmbedding(SAMPLE_TEXT),
          'Gemini API call failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    });
  });

  describe('Given generateWithTools, When called', () => {
    describe('And the model returns a function call', () => {
      test('Then it returns tool_call with the tool name and args', async () => {
        mockSendMessage.mockResolvedValueOnce({
          response: {
            functionCalls: () => [{ name: 'searchBookmarks', args: { query: 'Kafka' } }],
            text: () => '',
          },
        });

        const result = await sut.generateWithTools(AGENT_HISTORY, AGENT_TOOLS);

        expect(result).toEqual({ type: 'tool_call', toolName: 'searchBookmarks', args: { query: 'Kafka' } });
        expect(mockStartChat).toHaveBeenCalledWith({ history: [] }); // history slice(0,-1) is empty for single user message
        expect(mockSendMessage).toHaveBeenCalledWith([{ text: 'What do I know about Kafka?' }]);
      });
    });

    describe('And the model returns a text answer', () => {
      test('Then it returns final_answer with the text', async () => {
        mockSendMessage.mockResolvedValueOnce({
          response: {
            functionCalls: () => [],
            text: () => LLM_ANSWER,
          },
        });

        const result = await sut.generateWithTools(AGENT_HISTORY, AGENT_TOOLS);

        expect(result).toEqual({ type: 'final_answer', text: LLM_ANSWER });
      });
    });

    describe('And history includes a prior tool_result', () => {
      test('Then prior turns go to startChat history and tool_result goes to sendMessage as functionResponse', async () => {
        mockSendMessage.mockResolvedValueOnce({
          response: { functionCalls: () => [], text: () => LLM_ANSWER },
        });

        const historyWithToolResult: AgentMessage[] = [
          { role: 'user', text: 'What do I know about Kafka?' },
          { role: 'tool_call', toolName: 'searchBookmarks', args: { query: 'Kafka' } },
          { role: 'tool_result', toolName: 'searchBookmarks', result: { found: 1 } },
        ];

        await sut.generateWithTools(historyWithToolResult, AGENT_TOOLS);

        expect(mockStartChat).toHaveBeenCalledWith({
          history: [
            { role: 'user', parts: [{ text: 'What do I know about Kafka?' }] },
            { role: 'model', parts: [{ functionCall: { name: 'searchBookmarks', args: { query: 'Kafka' } } }] },
          ],
        });
        expect(mockSendMessage).toHaveBeenCalledWith([
          { functionResponse: { name: 'searchBookmarks', response: { result: { found: 1 } } } },
        ]);
      });
    });

    describe('And the last history message has an unexpected role', () => {
      test('Then it throws 500 before calling the API', async () => {
        const badHistory: AgentMessage[] = [
          { role: 'user', text: 'question' },
          { role: 'tool_call', toolName: 'searchBookmarks', args: { query: 'Kafka' } },
        ];

        await AssertUtils.assertError(
          () => sut.generateWithTools(badHistory, AGENT_TOOLS),
          'generateWithTools called with unexpected last message role: tool_call',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
        expect(mockSendMessage).not.toHaveBeenCalled();
      });
    });

    describe('And the Gemini API throws', () => {
      test('Then it throws 500 with "Gemini API call failed"', async () => {
        mockSendMessage.mockRejectedValueOnce(new Error('upstream error'));

        await AssertUtils.assertError(
          () => sut.generateWithTools(AGENT_HISTORY, AGENT_TOOLS),
          'Gemini API call failed',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      });
    });
  });

  describe('Given generateTextStream, When called', () => {
    describe('And Gemini streams chunks', () => {
      test('Then it yields each chunk of text as it arrives', async () => {
        mockGenerateContentStream.mockResolvedValueOnce({
          stream: asyncIterableOf([{ text: () => 'Kafka ' }, { text: () => 'preserves order.' }]),
          response: Promise.resolve({ usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } }),
        });

        const chunks: string[] = [];
        for await (const chunk of sut.generateTextStream(SYSTEM_PROMPT, USER_MESSAGE)) {
          chunks.push(chunk);
        }

        expect(chunks).toEqual(['Kafka ', 'preserves order.']);
        expect(geminiClient.getGenerativeModel).toHaveBeenCalledWith({
          model: 'gemini-2.5-flash',
          systemInstruction: SYSTEM_PROMPT,
        });
        expect(mockGenerateContentStream).toHaveBeenCalledWith(USER_MESSAGE);
      });

      test('Then it records the metric under whatever operation is tagged in AiUsageContextService at the time each chunk resolves', async () => {
        usageContext.getOperation.mockReturnValue('RAG_ASK');
        mockGenerateContentStream.mockResolvedValueOnce({
          stream: asyncIterableOf([{ text: () => LLM_ANSWER }]),
          response: Promise.resolve({ usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } }),
        });

        for await (const _chunk of sut.generateTextStream(SYSTEM_PROMPT, USER_MESSAGE)) {
          // drain the stream so the post-stream usage recording runs
        }

        expect(metricsReporter.record).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: 'RAG_ASK',
            model: 'gemini-2.5-flash',
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            durationMs: expect.any(Number),
          }),
        );
      });
    });

    describe('And the Gemini API throws', () => {
      test('Then it throws 500 with "Gemini API call failed"', async () => {
        mockGenerateContentStream.mockRejectedValueOnce(new Error('upstream error'));

        const consume = async () => {
          for await (const _chunk of sut.generateTextStream(SYSTEM_PROMPT, USER_MESSAGE)) {
            // no-op
          }
        };

        await AssertUtils.assertError(consume, 'Gemini API call failed', HttpStatus.INTERNAL_SERVER_ERROR);
        expect(metricsReporter.record).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given usage tracking, When a generation method is called', () => {
    describe('And AiUsageContextService has an operation tagged (i.e. called from within a @TrackAiUsage-wrapped method)', () => {
      test('Then it records the metric under that operation with the extracted token usage', async () => {
        usageContext.getOperation.mockReturnValue('RAG_ASK');
        mockGenerateContent.mockResolvedValueOnce({
          response: {
            text: () => LLM_ANSWER,
            usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20, totalTokenCount: 70 },
          },
        });

        await sut.generateText(SYSTEM_PROMPT, USER_MESSAGE);

        expect(metricsReporter.record).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: 'RAG_ASK',
            model: 'gemini-2.5-flash',
            usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
            durationMs: expect.any(Number),
          }),
        );
      });
    });

    describe('And AiUsageContextService has no operation tagged (called outside any @TrackAiUsage method)', () => {
      test('Then it does not record a metric', async () => {
        mockGenerateContent.mockResolvedValueOnce({
          response: { text: () => LLM_ANSWER, usageMetadata: undefined },
        });

        await sut.generateText(SYSTEM_PROMPT, USER_MESSAGE);

        expect(metricsReporter.record).not.toHaveBeenCalled();
      });
    });
  });
});
