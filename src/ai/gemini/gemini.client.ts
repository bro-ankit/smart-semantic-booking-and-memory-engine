import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { GoogleGenerativeAI, SchemaType, type Schema, type Content, type Part, FunctionDeclarationSchema, EmbedContentRequest } from '@google/generative-ai';
import { GEMINI_CLIENT, GEMINI_ERRORS } from './gemini.constants';
import type { IAiClient, AiResponseSchema, AiSchemaProperty, AgentMessage, AgentTool, AgentTurnResult } from '../ai.interface';
import { Resilient } from '../../resilience';

const GENERATION_MODEL = 'gemini-2.5-flash';
const EMBEDDING_MODEL = 'gemini-embedding-001';

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
        responseSchema: this.toGeminiSchema(schema),
      },
    });

    const rawJson = await this.executeGeneration(model, prompt);
    return this.parseJson(rawJson);
  }

  async generateText(systemPrompt: string, userMessage: string): Promise<string> {
    this.logger.info({ model: GENERATION_MODEL }, 'Sending free-text generation request');

    const model = this.client.getGenerativeModel({
      model: GENERATION_MODEL,
      systemInstruction: systemPrompt,
    });

    return this.executeGeneration(model, userMessage);
  }

  async generateWithTools(history: AgentMessage[], tools: AgentTool[]): Promise<AgentTurnResult> {
    this.logger.info({ model: GENERATION_MODEL, historyLength: history.length }, 'Agent turn with tools');

    const model = this.client.getGenerativeModel({
      model: GENERATION_MODEL,
      tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: this.toGeminiSchema(t.parameters) as FunctionDeclarationSchema })) }],
    });

    const conversationHistory = this.toGeminiHistory(history.slice(0, -1));
    const lastParts = this.toLastParts(history[history.length - 1]);

    try {
      const chat = model.startChat({ history: conversationHistory });
      const result = await chat.sendMessage(lastParts);
      const functionCalls = result.response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0]!;
        return { type: 'tool_call', toolName: call.name, args: call.args as Record<string, unknown> };
      }

      return { type: 'final_answer', text: result.response.text() };
    } catch (err) {
      this.logger.error({ err }, GEMINI_ERRORS.API_CALL_FAILED);
      throw new InternalServerErrorException(GEMINI_ERRORS.API_CALL_FAILED, { cause: err });
    }
  }

  @Resilient()
  async generateEmbedding(text: string): Promise<number[]> {
    this.logger.info({ model: EMBEDDING_MODEL }, 'Generating embedding');
    try {
      const model = this.client.getGenerativeModel({ model: EMBEDDING_MODEL });
      const result = await model.embedContent({ content: { role: 'user', parts: [{ text }] }, outputDimensionality: 768 } as EmbedContentRequest);
      return result.embedding.values;
    } catch (err) {
      this.logger.error({ err }, GEMINI_ERRORS.API_CALL_FAILED);
      throw new InternalServerErrorException(GEMINI_ERRORS.API_CALL_FAILED, { cause: err });
    }
  }

  private toGeminiSchema(prop: AiSchemaProperty | AiResponseSchema): Schema {
    switch (prop.type) {
      case 'string':
        return { type: SchemaType.STRING } satisfies Schema;
      case 'number':
        return { type: SchemaType.NUMBER } satisfies Schema;
      case 'boolean':
        return { type: SchemaType.BOOLEAN } satisfies Schema;
      case 'array':
        return { type: SchemaType.ARRAY, items: this.toGeminiSchema(prop.items!) } satisfies Schema;
      case 'object': {
        const obj = prop as AiResponseSchema;
        return {
          type: SchemaType.OBJECT,
          properties: Object.fromEntries(
            Object.entries(obj.properties).map(([k, v]) => [k, this.toGeminiSchema(v)]),
          ),
          required: obj.required,
        } satisfies Schema;
      }
    }
  }

  private toGeminiHistory(messages: AgentMessage[]): Content[] {
    return messages.map((msg): Content => {
      switch (msg.role) {
        case 'user':
          return { role: 'user', parts: [{ text: msg.text }] };
        case 'model':
          return { role: 'model', parts: [{ text: msg.text }] };
        case 'tool_call':
          return { role: 'model', parts: [{ functionCall: { name: msg.toolName, args: msg.args } }] };
        case 'tool_result':
          return {
            role: 'function',
            parts: [{ functionResponse: { name: msg.toolName, response: { result: msg.result } } } satisfies Part],
          };
      }
    });
  }

  private toLastParts(message: AgentMessage): Part[] {
    if (message.role === 'user') {
      return [{ text: message.text }];
    }
    if (message.role === 'tool_result') {
      return [{ functionResponse: { name: message.toolName, response: { result: message.result } } } satisfies Part];
    }
    throw new InternalServerErrorException(`generateWithTools called with unexpected last message role: ${message.role}`);
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
