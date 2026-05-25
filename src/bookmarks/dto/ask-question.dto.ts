import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AskQuestionDto {
  @ApiProperty({ type: String, description: 'Question to answer from your saved bookmarks' })
  @IsString()
  @IsNotEmpty()
  question!: string;
}
