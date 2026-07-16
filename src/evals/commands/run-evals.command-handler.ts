import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { plainToInstance } from 'class-transformer';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { RAGService } from '../../bookmarks/rag/rag.service';
import { ENV_VARIABLES } from '../../constants/env.constants';
import type { EvalRunSelect } from '../../schema/eval-runs.schema';
import { RunEvalsResponseDto } from '../dto/run-evals-response.dto';
import { EVAL_WEAK_THRESHOLD } from '../evals.constants';
import { EvalsRepository } from '../evals.repository';
import { EvalGoldenSetService } from '../golden-set/eval-golden-set.service';
import { EvalJudgeService } from '../judge/eval-judge.service';
import { RunEvalsCommand } from './run-evals.command';

const DTO_OPTIONS = { excludeExtraneousValues: true } as const;

@CommandHandler(RunEvalsCommand)
export class RunEvalsCommandHandler implements ICommandHandler<RunEvalsCommand, RunEvalsResponseDto> {
  private readonly interCaseDelayMs?: number;

  constructor(
    @InjectPinoLogger(RunEvalsCommandHandler.name) private readonly logger: PinoLogger,
    private readonly goldenSetService: EvalGoldenSetService,
    private readonly ragService: RAGService,
    private readonly evalJudgeService: EvalJudgeService,
    private readonly evalsRepository: EvalsRepository,
    config: ConfigService,
  ) {
    this.interCaseDelayMs = config.get<number>(ENV_VARIABLES.EVAL.INTER_CASE_DELAY_MS);
  }

  async execute(_command: RunEvalsCommand): Promise<RunEvalsResponseDto> {
    this.logger.info(`Executing Run Evals Command`);

    const goldenCases = this.goldenSetService.load();
    this.logger.info({ total: goldenCases.length }, 'Starting eval run');

    const stored: EvalRunSelect[] = [];

    for (let i = 0; i < goldenCases.length; i++) {
      const goldenCase = goldenCases[i];
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
          {
            question: goldenCase.question,
            relevance: scores.relevance,
            faithfulness: scores.faithfulness,
            case: `${i + 1}/${goldenCases.length}`,
          },
          'Eval case scored',
        );
      } catch (err) {
        this.logger.error({ err, question: goldenCase.question }, 'Eval case failed — skipping');
      }

      if (this.interCaseDelayMs && i < goldenCases.length - 1) {
        await this.sleep(this.interCaseDelayMs);
      }
    }

    return this.buildSummary(stored);
  }

  private buildSummary(runs: EvalRunSelect[]): RunEvalsResponseDto {
    const n = runs.length;

    const avgRelevance = n === 0 ? 0 : this.round2(runs.reduce((s, r) => s + r.relevanceScore, 0) / n);
    const avgFaithfulness = n === 0 ? 0 : this.round2(runs.reduce((s, r) => s + r.faithfulnessScore, 0) / n);

    const weakCases = runs
      .filter((r) => r.relevanceScore < EVAL_WEAK_THRESHOLD || r.faithfulnessScore < EVAL_WEAK_THRESHOLD)
      .map((r) => ({
        question: r.goldenQuestion,
        relevanceScore: r.relevanceScore,
        faithfulnessScore: r.faithfulnessScore,
      }));

    return plainToInstance(
      RunEvalsResponseDto,
      { totalCases: n, avgRelevance, avgFaithfulness, weakCases, runs },
      DTO_OPTIONS,
    );
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
