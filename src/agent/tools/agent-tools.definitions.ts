import type { AgentTool } from '../../ai/ai.interface';
import { TOOL_NAMES } from '../agent.constants';

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: TOOL_NAMES.SEARCH_BOOKMARKS,
    description: 'Search saved bookmarks semantically by a natural language query. Use this to find relevant knowledge before answering a question.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: TOOL_NAMES.CREATE_TODO,
    description: 'Create an action item linked to a specific bookmark. Use this when the user wants to track a task related to a saved resource.',
    parameters: {
      type: 'object',
      properties: {
        bookmarkId: { type: 'string' },
        task: { type: 'string' },
      },
      required: ['bookmarkId', 'task'],
    },
  },
  {
    name: TOOL_NAMES.SUMMARIZE_TAG,
    description: 'Return all bookmarks with a given tag and a synthesised summary of what you know about that topic. Use this when the user asks about a topic or category.',
    parameters: {
      type: 'object',
      properties: {
        tag: { type: 'string' },
      },
      required: ['tag'],
    },
  },
];
