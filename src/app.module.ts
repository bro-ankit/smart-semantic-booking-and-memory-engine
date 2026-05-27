import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from './database/database.module';
import { AiModule } from './ai/ai.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { ResilienceModule } from './resilience';

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
    ResilienceModule,
    DatabaseModule,
    AiModule,
    BookmarksModule,
  ],
})
export class AppModule { }
