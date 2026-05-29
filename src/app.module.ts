import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './database/database.module';
import { AiModule } from './ai/ai.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { ResilienceModule } from './resilience';
import { ENV_VARIABLES } from './constants/env.constants';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
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
    DatabaseModule,
    AiModule,
    BookmarksModule,
  ],
})
export class AppModule { }
