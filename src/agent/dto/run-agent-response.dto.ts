import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ToolCallTraceDto {
  @Expose() @ApiProperty({ type: Number }) iteration!: number;
  @Expose() @ApiProperty({ type: String }) toolName!: string;
  @Expose() @ApiProperty({ type: Object }) args!: Record<string, unknown>;
  @Expose() @ApiProperty({ type: Object }) result!: unknown;
}

export class RunAgentResponseDto {
  @Expose() @ApiProperty({ type: String }) answer!: string;
  @Expose() @ApiProperty({ type: Boolean }) truncated!: boolean;
  @Expose() @ApiProperty({ type: [ToolCallTraceDto] }) @Type(() => ToolCallTraceDto) toolCallTrace!: ToolCallTraceDto[];
}
