import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SearchQueryDto } from '../dto/search-query.dto';
import { SearchResultDto } from '../dto/search-result.dto';
import { SearchQuery } from './search.query';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'Hybrid search — vector + keyword fused with RRF, returns top 3 bookmarks' })
  @ApiOkResponse({ type: [SearchResultDto] })
  search(@Query() dto: SearchQueryDto): Promise<SearchResultDto[]> {
    return this.queryBus.execute(new SearchQuery(dto.q));
  }
}
