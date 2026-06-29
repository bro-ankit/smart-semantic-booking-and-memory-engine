export const AGENT_MAX_ITERATIONS = 5;

export const AGENT_ERRORS = {
  UNKNOWN_TOOL: (name: string) => `Agent called unknown tool: ${name}`,
  TOOL_EXECUTION_FAILED: (name: string) => `Tool "${name}" failed during execution`,
} as const;

export const TOOL_NAMES = {
  SEARCH_BOOKMARKS: 'searchBookmarks',
  CREATE_TODO: 'createTodo',
  SUMMARIZE_TAG: 'summarizeTag',
} as const;
