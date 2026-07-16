import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { AgentModule } from './agent/agent.module';
import { AiModule } from './ai/ai.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { ENV_VARIABLES } from './constants/env.constants';
import { DatabaseModule } from './database/database.module';
import { EvalsModule } from './evals/evals.module';
import { MetricsModule } from './metrics/metrics.module';
import { ResilienceModule } from './resilience';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
        redact: {
          paths: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-api-key"]'],
          censor: '[REDACTED]',
        },
      },
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>(ENV_VARIABLES.REDIS.HOST, 'localhost'),
          port: config.get<number>(ENV_VARIABLES.REDIS.PORT, 6379),
        },
      }),
    }),
    ResilienceModule,
    MetricsModule,
    DatabaseModule,
    AiModule,
    BookmarksModule,
    EvalsModule,
    AgentModule,
  ],
})
export class AppModule {}
