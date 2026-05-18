import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../schema';
import { DRIZZLE_DB } from './database.constants';
import { DATABASE_CONFIG } from '../config/database.config';
import type { DatabaseConfig } from '../config/database.config';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type DrizzleDb = NodePgDatabase<typeof schema>;

const drizzleProvider = {
  provide: DRIZZLE_DB,
  inject: [ConfigService],
  useFactory: (config: ConfigService): DrizzleDb => {
    const db = config.get<DatabaseConfig>(DATABASE_CONFIG)!;
    const pool = new Pool({
      host: db.host,
      port: db.port,
      user: db.user,
      password: db.password,
      database: db.database,
      max: db.poolSize,
    });
    return drizzle(pool, { schema });
  },
};

@Global()
@Module({
  providers: [drizzleProvider],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule { }
