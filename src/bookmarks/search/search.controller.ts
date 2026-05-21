import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from '../dto/search-query.dto';
import { SearchResultDto } from '../dto/search-result.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Semantic search — finds top 3 bookmarks closest to the query by cosine similarity' })
  @ApiOkResponse({ type: [SearchResultDto] })
  search(@Query() dto: SearchQueryDto): Promise<SearchResultDto[]> {
    return this.searchService.search(dto.q);
  }
}
