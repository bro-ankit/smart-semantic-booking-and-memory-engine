import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class WeakCaseDto {
  @Expose() @ApiProperty({ type: String }) question!: string;
  @Expose() @ApiProperty({ type: Number }) relevanceScore!: number;
  @Expose() @ApiProperty({ type: Number }) faithfulnessScore!: number;
}

export class EvalRunItemDto {
  @Expose() @ApiProperty({ type: String }) id!: string;
  @Expose() @ApiProperty({ type: String }) goldenQuestion!: string;
  @Expose() @ApiProperty({ type: Number }) relevanceScore!: number;
  @Expose() @ApiProperty({ type: Number }) faithfulnessScore!: number;
  @Expose() @ApiProperty({ type: String }) reasoning!: string;
  @Expose() @ApiProperty({ type: Date }) @Type(() => Date) createdAt!: Date;
}

export class RunEvalsResponseDto {
  @Expose() @ApiProperty({ type: Number }) totalCases!: number;
  @Expose() @ApiProperty({ type: Number }) avgRelevance!: number;
  @Expose() @ApiProperty({ type: Number }) avgFaithfulness!: number;
  @Expose() @ApiProperty({ type: [WeakCaseDto] }) @Type(() => WeakCaseDto) weakCases!: WeakCaseDto[];
  @Expose() @ApiProperty({ type: [EvalRunItemDto] }) @Type(() => EvalRunItemDto) runs!: EvalRunItemDto[];
}
