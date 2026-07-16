import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { BookmarksModule } from '../bookmarks/bookmarks.module';
import { EVALS_COMMAND_HANDLERS } from './commands';
import { EvalsController } from './evals.controller';
import { EvalsRepository } from './evals.repository';
import { EvalGoldenSetService } from './golden-set/eval-golden-set.service';
import { EvalJudgeService } from './judge/eval-judge.service';

@Module({
  imports: [CqrsModule, BookmarksModule],
  controllers: [EvalsController],
  providers: [EvalsRepository, EvalJudgeService, EvalGoldenSetService, ...EVALS_COMMAND_HANDLERS],
})
export class EvalsModule {}
