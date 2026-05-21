import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { type IngestionStatus, INGESTION_STATUSES } from '../../schema/bookmarks.schema';

export class SearchResultDto {
  @Expose()
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @Expose()
  @ApiProperty({ type: String })
  originalUrl!: string;

  @Expose()
  @ApiProperty({ type: String })
  contentSummary!: string;

  @Expose()
  @ApiProperty({ type: [String] })
  tags!: string[];

  @Expose()
  @ApiProperty({ enum: INGESTION_STATUSES, enumName: 'IngestionStatus' })
  status!: IngestionStatus;

  @Expose()
  @ApiProperty({ type: Date })
  createdAt!: Date;
}
