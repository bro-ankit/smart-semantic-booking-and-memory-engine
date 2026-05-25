import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class AskResponseDto {
  @Expose()
  @ApiProperty({ type: String, description: 'LLM answer grounded in your bookmarks context' })
  answer!: string;
}
