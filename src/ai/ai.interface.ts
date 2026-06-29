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

export type AgentTool = {
  name: string;
  description: string;
  parameters: AiResponseSchema;
};

export type AgentMessage =
  | { role: 'user'; text: string }
  | { role: 'model'; text: string }
  | { role: 'tool_call'; toolName: string; args: Record<string, unknown> }
  | { role: 'tool_result'; toolName: string; result: unknown };

export type AgentTurnResult =
  | { type: 'tool_call'; toolName: string; args: Record<string, unknown> }
  | { type: 'final_answer'; text: string };

export interface IAiClient {
  generateStructured(prompt: string, schema: AiResponseSchema): Promise<unknown>;
  generateEmbedding(text: string): Promise<number[]>;
  generateText(systemPrompt: string, userMessage: string): Promise<string>;
  generateWithTools(history: AgentMessage[], tools: AgentTool[]): Promise<AgentTurnResult>;
}
