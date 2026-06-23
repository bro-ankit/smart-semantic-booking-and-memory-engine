import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { plainToInstance } from 'class-transformer';
import { RunEvalsCommand } from './run-evals.command';
import { EvalsRepository } from '../evals.repository';
import { EvalJudgeService } from '../judge/eval-judge.service';
import { EvalGoldenSetService } from '../golden-set/eval-golden-set.service';
import { RAGService } from '../../bookmarks/rag/rag.service';
import { RunEvalsResponseDto } from '../dto/run-evals-response.dto';
import { EVAL_WEAK_THRESHOLD } from '../evals.constants';
import type { EvalRunSelect } from '../../schema/eval-runs.schema';

const DTO_OPTIONS = { excludeExtraneousValues: true } as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@CommandHandler(RunEvalsCommand)
export class RunEvalsCommandHandler implements ICommandHandler<RunEvalsCommand, RunEvalsResponseDto> {
  constructor(
    @InjectPinoLogger(RunEvalsCommandHandler.name) private readonly logger: PinoLogger,
    private readonly goldenSetService: EvalGoldenSetService,
    private readonly ragService: RAGService,
    private readonly evalJudgeService: EvalJudgeService,
    private readonly evalsRepository: EvalsRepository,
  ) { }

  async execute(_command: RunEvalsCommand): Promise<RunEvalsResponseDto> {
    this.logger.info(`Executing Run Evals Command`);

    const goldenCases = this.goldenSetService.load();
    this.logger.info({ total: goldenCases.length }, 'Starting eval run');

    const stored: EvalRunSelect[] = [];

    for (const goldenCase of goldenCases) {
      try {
        const { answer, contextChunks } = await this.ragService.execute(goldenCase.question);
        const scores = await this.evalJudgeService.score({
          question: goldenCase.question,
          answer,
          expectedTopics: goldenCase.expectedTopics,
          contextChunks,
        });
        const run = await this.evalsRepository.insert({
          goldenQuestion: goldenCase.question,
          expectedTopics: goldenCase.expectedTopics,
          expectedSourceTag: goldenCase.expectedSourceTag ?? null,
          answer,
          contextChunks,
          relevanceScore: scores.relevance,
          faithfulnessScore: scores.faithfulness,
          reasoning: scores.reasoning,
        });
        stored.push(run);
        this.logger.info(
          { question: goldenCase.question, relevance: scores.relevance, faithfulness: scores.faithfulness },
          'Eval case scored',
        );
      } catch (err) {
        this.logger.error({ err, question: goldenCase.question }, 'Eval case failed — skipping');
      }
    }

    return this.buildSummary(stored);
  }

  private buildSummary(runs: EvalRunSelect[]): RunEvalsResponseDto {
    const n = runs.length;

    const avgRelevance = n === 0 ? 0 : round2(runs.reduce((s, r) => s + r.relevanceScore, 0) / n);
    const avgFaithfulness = n === 0 ? 0 : round2(runs.reduce((s, r) => s + r.faithfulnessScore, 0) / n);

    const weakCases = runs
      .filter((r) => r.relevanceScore < EVAL_WEAK_THRESHOLD || r.faithfulnessScore < EVAL_WEAK_THRESHOLD)
      .map((r) => ({ question: r.goldenQuestion, relevanceScore: r.relevanceScore, faithfulnessScore: r.faithfulnessScore }));

    // @Type(() => EvalRunItemDto) and @Type(() => WeakCaseDto) on RunEvalsResponseDto handle nested transformation
    return plainToInstance(
      RunEvalsResponseDto,
      { totalCases: n, avgRelevance, avgFaithfulness, weakCases, runs },
      DTO_OPTIONS,
    );
  }
}
