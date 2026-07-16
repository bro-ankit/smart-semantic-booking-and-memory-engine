import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { SearchResultDto } from '../dto/search-result.dto';
import { SearchQuery } from './search.query';
import { SearchService } from './search.service';

@QueryHandler(SearchQuery)
export class SearchQueryHandler implements IQueryHandler<SearchQuery, SearchResultDto[]> {
  constructor(
    @InjectPinoLogger(SearchQueryHandler.name) private readonly logger: PinoLogger,
    private readonly searchService: SearchService,
  ) {}

  async execute(query: SearchQuery): Promise<SearchResultDto[]> {
    this.logger.debug({ q: query.q }, 'Executing search query');
    const bookmarks = await this.searchService.search(query.q);
    return plainToInstance(SearchResultDto, bookmarks, { excludeExtraneousValues: true });
  }
}
