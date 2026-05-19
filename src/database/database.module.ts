import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../schema';
import { DRIZZLE_DB } from './database.constants';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ENV_VARIABLES } from '../constants/env.constants';

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
  providers: [DRIZZLE_PROVIDER],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule { }