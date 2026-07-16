import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { AI_CLIENT } from '../../ai/ai.constants';
import type { IAiClient } from '../../ai/ai.interface';
import { BookmarksRepository } from '../../bookmarks/bookmarks.repository';
import { SearchService } from '../../bookmarks/search/search.service';
import { TodosRepository } from '../../bookmarks/todos.repository';
import { AGENT_ERRORS, TOOL_NAMES } from '../agent.constants';
import type { CreateTodoArgs, SearchBookmarksArgs, SummarizeTagArgs } from '../agent.types';

@Injectable()
export class AgentToolExecutorService {
  constructor(
    @InjectPinoLogger(AgentToolExecutorService.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    private readonly searchService: SearchService,
    private readonly bookmarksRepository: BookmarksRepository,
    private readonly todosRepository: TodosRepository,
  ) {}

  async execute(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    this.logger.info({ toolName, args }, 'Executing agent tool');

    switch (toolName) {
      case TOOL_NAMES.SEARCH_BOOKMARKS:
        return this.searchBookmarks(args as SearchBookmarksArgs);

      case TOOL_NAMES.CREATE_TODO:
        return this.createTodo(args as CreateTodoArgs);

      case TOOL_NAMES.SUMMARIZE_TAG:
        return this.summarizeTag(args as SummarizeTagArgs);

      default:
        throw new InternalServerErrorException(AGENT_ERRORS.UNKNOWN_TOOL(toolName));
    }
  }

  private async searchBookmarks({ query }: SearchBookmarksArgs): Promise<unknown> {
    const results = await this.searchService.search(query);
    if (results.length === 0) {
      return {
        found: 0,
        message:
          'No bookmarks found for this query. The knowledge base may not contain relevant content on this topic.',
      };
    }
    return {
      found: results.length,
      bookmarks: results.map((r) => ({ id: r.id, summary: r.contentSummary, tags: r.tags, url: r.originalUrl })),
    };
  }

  private async createTodo({ bookmarkId, task }: CreateTodoArgs): Promise<unknown> {
    const todo = await this.todosRepository.insert({ bookmarkId, task });
    return { created: true, todoId: todo.id, task: todo.task, bookmarkId: todo.bookmarkId };
  }

  private async summarizeTag({ tag }: SummarizeTagArgs): Promise<unknown> {
    const normalizedTag = tag.toLowerCase();
    const bookmarks = await this.bookmarksRepository.findByTag(normalizedTag);
    if (bookmarks.length === 0) {
      return { found: 0, message: `No completed bookmarks found with tag "${normalizedTag}".` };
    }

    const context = bookmarks.map((b) => `- ${b.contentSummary} (tags: ${b.tags.join(', ')})`).join('\n');

    const summary = await this.aiClient.generateText(
      `You are a knowledge synthesiser. Given a list of bookmark summaries on a topic, write a concise 3-4 sentence synthesis of what is known about the topic. Stick only to what the bookmarks say.`,
      `Topic: "${normalizedTag}"\n\nBookmarks:\n${context}`,
    );

    return { found: bookmarks.length, tag: normalizedTag, bookmarkIds: bookmarks.map((b) => b.id), synthesis: summary };
  }
}
