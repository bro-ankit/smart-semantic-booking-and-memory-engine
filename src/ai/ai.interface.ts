export type AiSchemaType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export type AiSchemaProperty = {
  type: AiSchemaType;
  items?: AiSchemaProperty;
}

export type AiResponseSchema = {
  type: 'object';
  properties: Record<string, AiSchemaProperty>;
  required: string[];
}

export interface IAiClient {
  generateStructured(prompt: string, schema: AiResponseSchema): Promise<unknown>;
  generateEmbedding(text: string): Promise<number[]>;
}
