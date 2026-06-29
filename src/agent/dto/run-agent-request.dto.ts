import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RunAgentRequestDto {
  @ApiProperty({ type: String, example: 'What do I know about Kafka? Create a todo to read the consumer groups article.' })
  @IsString()
  @MinLength(1)
  question!: string;
}
