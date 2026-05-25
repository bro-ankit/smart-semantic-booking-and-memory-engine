import { Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AI_CLIENT } from '../../ai/ai.constants';
import type { IAiClient } from '../../ai/ai.interface';
import { BookmarksRepository } from '../bookmarks.repository';
import { SearchResultDto } from '../dto/search-result.dto';
import { SEARCH_DEFAULTS } from './search.constants';

@Injectable()
export class SearchService {
  constructor(
    @InjectPinoLogger(SearchService.name) private readonly logger: PinoLogger,
    @Inject(AI_CLIENT) private readonly aiClient: IAiClient,
    private readonly bookmarksRepository: BookmarksRepository,
  ) {}

  async search(query: string): Promise<SearchResultDto[]> {
    this.logger.info({ query }, 'Semantic search request');

    const embedding = await this.aiClient.generateEmbedding(query);
    const results = await this.bookmarksRepository.findSimilar(embedding, SEARCH_DEFAULTS.TOP_K, SEARCH_DEFAULTS.MAX_DISTANCE);

    return results.map((bookmark) =>
      plainToInstance(SearchResultDto, bookmark, { excludeExtraneousValues: true }),
    );
  }
}
