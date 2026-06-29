import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BookmarksModule } from '../bookmarks/bookmarks.module';
import { EvalsController } from './evals.controller';
import { EvalsRepository } from './evals.repository';
import { EvalJudgeService } from './judge/eval-judge.service';
import { EvalGoldenSetService } from './golden-set/eval-golden-set.service';
import { EVALS_COMMAND_HANDLERS } from './commands';

@Module({
  imports: [CqrsModule, BookmarksModule],
  controllers: [EvalsController],
  providers: [
    EvalsRepository,
    EvalJudgeService,
    EvalGoldenSetService,
    ...EVALS_COMMAND_HANDLERS,
  ],
})
export class EvalsModule {}
