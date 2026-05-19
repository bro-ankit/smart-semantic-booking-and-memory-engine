import { HttpStatus } from '@nestjs/common';
import { TestBed } from '@automock/jest';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { GeminiClient } from '../../../src/ai/gemini/gemini.client';
import { GEMINI_CLIENT } from '../../../src/ai/gemini/gemini.constants';
import type { AiResponseSchema } from '../../../src/ai/ai.interface';
import { AssertUtils } from '../../utils/assert.utils';

const PROMPT = 'Extract structured data from this text about Kafka partitioning.';

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

describe('GeminiClient Unit Test', () => {
  let sut: GeminiClient;
  let geminiClient: jest.Mocked<GoogleGenerativeAI>;

  const mockGenerateContent = jest.fn();

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(GeminiClient).compile();
    sut = unit;
    geminiClient = unitRef.get<GoogleGenerativeAI>(GEMINI_CLIENT);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    geminiClient.getGenerativeModel.mockReturnValue({ generateContent: mockGenerateContent } as never);
  });

  describe('Given generateStructured, When called', () => {
    describe('And Gemini returns valid JSON', () => {
      test('Then it returns the parsed object', async () => {
        mockGenerateContent.mockResolvedValueOnce({
          response: { text: () => JSON.stringify(PARSED_RESPONSE) },
        });

        const result = await sut.generateStructured(PROMPT, INPUT_SCHEMA);

        expect(result).toEqual(PARSED_RESPONSE);
      });

      test('Then it calls getGenerativeModel with json mime type and the mapped Gemini schema', async () => {
        mockGenerateContent.mockResolvedValueOnce({
          response: { text: () => JSON.stringify(PARSED_RESPONSE) },
        });

        await sut.generateStructured(PROMPT, INPUT_SCHEMA);

        expect(geminiClient.getGenerativeModel).toHaveBeenCalledWith({
          model: 'gemini-2.5-flash',
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: EXPECTED_GEMINI_SCHEMA,
          },
        });
      });

      test('Then it calls generateContent with the prompt', async () => {
        mockGenerateContent.mockResolvedValueOnce({
          response: { text: () => JSON.stringify(PARSED_RESPONSE) },
        });

        await sut.generateStructured(PROMPT, INPUT_SCHEMA);

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
});
