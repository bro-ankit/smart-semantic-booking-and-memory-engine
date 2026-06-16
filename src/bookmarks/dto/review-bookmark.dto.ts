import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class ReviewBookmarkDto {
  @ApiProperty({ description: 'Approve or reject the AI-generated enrichment.' })
  @IsBoolean()
  approved!: boolean;

  @ApiPropertyOptional({ description: 'Override the AI summary. Only used when approved is true.' })
  @IsOptional()
  @IsString()
  editedSummary?: string;

  @ApiPropertyOptional({ description: 'Override the AI tags. Only used when approved is true.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  editedTags?: string[];
}
