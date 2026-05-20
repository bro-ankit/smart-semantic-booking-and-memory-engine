import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import { GEMINI_CLIENT, GEMINI_ERRORS } from './gemini.constants';
import type { IAiClient, AiResponseSchema, AiSchemaProperty } from '../ai.interface';

const GENERATION_MODEL = 'gemini-2.5-flash';
const EMBEDDING_MODEL = 'text-embedding-004';

function toGeminiSchema(prop: AiSchemaProperty | AiResponseSchema): Schema {
  switch (prop.type) {
    case 'string':
      return { type: SchemaType.STRING } as Schema;
    case 'number':
      return { type: SchemaType.NUMBER } as Schema;
    case 'boolean':
      return { type: SchemaType.BOOLEAN } as Schema;
    case 'array':
      return { type: SchemaType.ARRAY, items: toGeminiSchema(prop.items!) } as Schema;
    case 'object': {
      const obj = prop as AiResponseSchema;
      return {
        type: SchemaType.OBJECT,
        properties: Object.fromEntries(
          Object.entries(obj.properties).map(([k, v]) => [k, toGeminiSchema(v)]),
        ),
        required: obj.required,
      } as Schema;
    }
  }
}

@Injectable()
export class GeminiClient implements IAiClient {
  constructor(
    @InjectPinoLogger(GeminiClient.name) private readonly logger: PinoLogger,
    @Inject(GEMINI_CLIENT) private readonly client: GoogleGenerativeAI,
  ) { }

  async generateStructured(prompt: string, schema: AiResponseSchema): Promise<unknown> {
    this.logger.info({ model: GENERATION_MODEL }, 'Sending structured generation request');

    const model = this.client.getGenerativeModel({
      model: GENERATION_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(schema),
      },
    });

    const rawJson = await this.executeGeneration(model, prompt);
    return this.parseJson(rawJson);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    this.logger.info({ model: EMBEDDING_MODEL }, 'Generating embedding');
    try {
      const model = this.client.getGenerativeModel({ model: EMBEDDING_MODEL });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (err) {
      this.logger.error({ err }, GEMINI_ERRORS.API_CALL_FAILED);
      throw new InternalServerErrorException(GEMINI_ERRORS.API_CALL_FAILED, { cause: err });
    }
  }

  private async executeGeneration(model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>, prompt: string): Promise<string> {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      this.logger.error({ err }, GEMINI_ERRORS.API_CALL_FAILED);
      throw new InternalServerErrorException(GEMINI_ERRORS.API_CALL_FAILED, { cause: err });
    }
  }

  private parseJson(rawJson: string): unknown {
    try {
      return JSON.parse(rawJson) as unknown;
    } catch (err) {
      this.logger.error({ err, rawJson }, GEMINI_ERRORS.NON_JSON_RESPONSE);
      throw new InternalServerErrorException(GEMINI_ERRORS.NON_JSON_RESPONSE);
    }
  }
}
