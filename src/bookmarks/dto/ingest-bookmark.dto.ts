import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class IngestBookmarkDto {
  @ApiProperty({ type: String, description: 'Raw text or URL to ingest and embed' })
  @IsString()
  @IsNotEmpty()
  rawText!: string;
}
