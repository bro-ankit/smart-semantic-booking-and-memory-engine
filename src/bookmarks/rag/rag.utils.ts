import { NO_CONTEXT_REPLY } from './rag.constants';
import type { SearchResultDto } from '../dto/search-result.dto';


export class RagUtils {
  static buildSystemPrompt(results: SearchResultDto[]): string {
    if (results.length === 0) {
      return [
        'You are a helpful assistant.',
        `If you cannot answer from the provided context, respond with: "${NO_CONTEXT_REPLY}"`,
        '',
        'Context: (no bookmarks found)',
      ].join('\n');
    }

    const contextBlocks = results
      .map(
        (r, i) =>
          `**Bookmark ${i + 1}**\nURL: ${r.originalUrl}\nSummary: ${r.contentSummary}\nTags: ${r.tags.join(', ')}`,
      )
      .join('\n\n');

    return [
      'You are a helpful assistant. Answer the user\'s question using ONLY the following bookmarked content.',
      `If the answer cannot be found in the provided context, respond with: "${NO_CONTEXT_REPLY}"`,
      '',
      'Context:',
      contextBlocks,
    ].join('\n');
  }
}
