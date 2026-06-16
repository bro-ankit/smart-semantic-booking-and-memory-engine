import { HttpStatus } from '@nestjs/common';
import { TestBed } from '@automock/jest';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { GeminiClient } from '../../../src/ai/gemini/gemini.client';
import { GEMINI_CLIENT } from '../../../src/ai/gemini/gemini.constants';
import type { AiResponseSchema } from '../../../src/ai/ai.interface';
import { AssertUtils } from '../../utils/assert.utils';

const PROMPT = 'Extract structured data from this text about Kafka partitioning.';
const SAMPLE_TEXT = 'NestJS dependency injection patterns for scalable services';
const SYSTEM_PROMPT = 'Answer only from the provided context.';
const USER_MESSAGE = 'How does Kafka handle message ordering?';
const LLM_ANSWER = 'Kafka preserves order within a partition.';

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

  const mockGenerateContent = jest.fn();
  const mockEmbedContent = jest.fn();

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(GeminiClient).compile();
    sut = unit;
    geminiClient = unitRef.get<GoogleGenerativeAI>(GEMINI_CLIENT);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    geminiClient.getGenerativeModel.mockReturnValue({
      generateContent: mockGenerateContent,
      embedContent: mockEmbedContent,
    } as never);
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
});
