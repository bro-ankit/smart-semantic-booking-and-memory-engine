import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { AI_CLIENT } from '../../ai/ai.constants';
import type { IAiClient } from '../../ai/ai.interface';
import type { BookmarkSelect } from '../../schema/bookmarks.schema';
import { BookmarksRepository } from '../bookmarks.repository';
import { RerankerService } from './reranker.service';
import { RrfUtil } from './rrf.util';
import { SEARCH_DEFAULTS } from './search.constants';

@Injectable()
export class SearchService {
  constructor(
    @InjectPinoLogger(SearchService.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    private readonly bookmarksRepository: BookmarksRepository,
    private readonly rerankerService: RerankerService,
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
    const poolIds = fused.slice(0, SEARCH_DEFAULTS.RERANK_POOL_K).map((r) => r.id);

    this.logger.debug({ scores: poolIds }, 'RRF-fused rerank pool');

    if (poolIds.length === 0) return [];

    const pool = await this.bookmarksRepository.findByIds(poolIds);
    const byId = new Map(pool.map((b) => [b.id, b]));

    const candidates = pool.map((b) => ({ id: b.id, text: `${b.contentSummary} ${b.tags.join(' ')}` }));
    const reranked = await this.rerankerService.rerank(query, candidates);

    this.logger.info({ scores: reranked.slice(0, SEARCH_DEFAULTS.TOP_K) }, 'Cross-encoder rerank scores');

    return reranked.slice(0, SEARCH_DEFAULTS.TOP_K).flatMap((r) => {
      const b = byId.get(r.id);
      return b ? [b] : [];
    });
  }
}
