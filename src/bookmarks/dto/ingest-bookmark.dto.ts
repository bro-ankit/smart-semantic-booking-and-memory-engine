import { IsNotEmpty, IsString } from 'class-validator';

export class IngestBookmarkDto {
  @IsString()
  @IsNotEmpty()
  rawText!: string;
}
