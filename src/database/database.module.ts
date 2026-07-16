import { Global, Inject, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as path from 'path';
import { Pool } from 'pg';

import { ENV_VARIABLES } from '../constants/env.constants';
import * as schema from '../schema';
import { DRIZZLE_DB } from './database.constants';
import { DrizzleTransactionContext } from './drizzle-transaction.context';
import { DrizzleTransactionService } from './drizzle-transaction.service';

export type DrizzleDb = NodePgDatabase<typeof schema>;

const DRIZZLE_PROVIDER = {
  provide: DRIZZLE_DB,
  inject: [ConfigService],
  useFactory: (config: ConfigService): DrizzleDb => {
    const dbHost = config.getOrThrow<string>(ENV_VARIABLES.DATABASE.host);
    const dbPort = parseInt(config.getOrThrow<string>(ENV_VARIABLES.DATABASE.port), 10);
    const dbUser = config.getOrThrow<string>(ENV_VARIABLES.DATABASE.user);
    const dbPassword = config.getOrThrow<string>(ENV_VARIABLES.DATABASE.password);
    const dbName = config.getOrThrow<string>(ENV_VARIABLES.DATABASE.database);
    const dbPoolSize = parseInt(config.getOrThrow<string>(ENV_VARIABLES.DATABASE.poolSize), 10);

    const pool = new Pool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      max: dbPoolSize,
    });

    return drizzle(pool, { schema });
  },
};

@Global()
@Module({
  providers: [DRIZZLE_PROVIDER, DrizzleTransactionContext, DrizzleTransactionService],
  exports: [DRIZZLE_DB, DrizzleTransactionContext, DrizzleTransactionService],
})
export class DatabaseModule implements OnModuleInit {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    @InjectPinoLogger(DatabaseModule.name) private readonly logger: PinoLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.info('Running database migrations...');
    await migrate(this.db, {
      migrationsFolder: path.join(process.cwd(), 'db/migrations'),
    });
    this.logger.info('Migrations complete.');
  }
}
