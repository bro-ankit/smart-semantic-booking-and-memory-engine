import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BookmarksModule } from '../bookmarks/bookmarks.module';
import { IngestModule } from '../ingest/ingest.module';
import { AgentController } from './agent.controller';
import { AgentToolExecutorService } from './tools/agent-tool-executor.service';
import { AGENT_COMMAND_HANDLERS } from './commands';

@Module({
  imports: [CqrsModule, BookmarksModule, IngestModule],
  controllers: [AgentController],
  providers: [AgentToolExecutorService, ...AGENT_COMMAND_HANDLERS],
})
export class AgentModule { }
