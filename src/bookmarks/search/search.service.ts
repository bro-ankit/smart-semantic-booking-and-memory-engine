import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { AI_CLIENT } from '../../ai/ai.constants';
import type { IAiClient } from '../../ai/ai.interface';
import type { BookmarkSelect } from '../../schema/bookmarks.schema';
import { BookmarksRepository } from '../bookmarks.repository';
import { RrfUtil } from './rrf.util';
import { SEARCH_DEFAULTS } from './search.constants';

@Injectable()
export class SearchService {
  constructor(
    @InjectPinoLogger(SearchService.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    private readonly bookmarksRepository: BookmarksRepository,
  ) {}

  async search(query: string): Promise<BookmarkSelect[]> {
    this.logger.info({ query }, 'Hybrid search request');

    const embedding = await this.aiClient.generateEmbedding(query);

    const [vectorIds, lexicalIds] = await Promise.all([
      this.bookmarksRepository.findSimilarIds(embedding, SEARCH_DEFAULTS.CANDIDATE_K),
      this.bookmarksRepository.findByLexical(query, SEARCH_DEFAULTS.CANDIDATE_K),
    ]);

    this.logger.debug({ vectorCount: vectorIds.length, lexicalCount: lexicalIds.length }, 'Candidate sets');

    const fused = RrfUtil.fuse(vectorIds, lexicalIds);
    const topIds = fused.slice(0, SEARCH_DEFAULTS.TOP_K).map((r) => r.id);

    this.logger.info({ scores: fused.slice(0, SEARCH_DEFAULTS.TOP_K) }, 'RRF scores');

    if (topIds.length === 0) return [];

    const bookmarks = await this.bookmarksRepository.findByIds(topIds);

    const byId = new Map(bookmarks.map((b) => [b.id, b]));
    return topIds.flatMap((id) => {
      const b = byId.get(id);
      return b ? [b] : [];
    });
  }
}
