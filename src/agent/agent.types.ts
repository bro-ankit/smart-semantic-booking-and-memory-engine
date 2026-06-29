export type ToolCallTrace = {
  readonly iteration: number;
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  readonly result: unknown;
};

export type AgentRunResult = {
  readonly answer: string;
  readonly toolCallTrace: ToolCallTrace[];
  readonly truncated: boolean;
};

// Typed arg shapes for each tool — used inside the executor to avoid casting to unknown
export type SearchBookmarksArgs = { query: string };
export type CreateTodoArgs = { bookmarkId: string; task: string };
export type SummarizeTagArgs = { tag: string };
