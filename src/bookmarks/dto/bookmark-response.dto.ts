import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { INGESTION_STATUSES, type IngestionStatus } from '../../schema/bookmarks.schema';

export class BookmarkResponseDto {
  @ApiProperty({ type: String }) @Expose() id!: string;
  @ApiProperty({ type: String }) @Expose() originalUrl!: string;
  @ApiProperty({ type: String }) @Expose() contentSummary!: string;
  @ApiProperty({ type: [String] }) @Expose() tags!: string[];
  @ApiProperty({ enum: INGESTION_STATUSES }) @Expose() status!: IngestionStatus;
  @ApiProperty({ type: String, nullable: true }) @Expose() errorMessage!: string | null;
  @ApiProperty({ type: String }) @Expose() aiContentSummary!: string;
  @ApiProperty({ type: [String] }) @Expose() aiTags!: string[];
  @ApiProperty({ type: [String] }) @Expose() aiActionItems!: string[];
  @ApiProperty({ type: Date }) @Expose() @Type(() => Date) createdAt!: Date;
}
