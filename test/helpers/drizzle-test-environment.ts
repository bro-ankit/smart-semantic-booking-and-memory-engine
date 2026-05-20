import { type Provider } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from '../../src/schema';
import { DRIZZLE_DB } from '../../src/database/database.constants';
import { DrizzleTransactionContext } from '../../src/database/drizzle-transaction.context';
import { DrizzleTransactionService } from '../../src/database/drizzle-transaction.service';
import type { DrizzleDb } from '../../src/database/database.module';

const PGVECTOR_IMAGE = 'pgvector/pgvector:pg16';
const MIGRATIONS_FOLDER = './db/migrations';

export class DrizzleTestEnvironment {
  private container!: StartedPostgreSqlContainer;
  private pool!: Pool;

  db!: DrizzleDb;
  module!: TestingModule;

  async start(providers: Provider[]): Promise<void> {
    this.container = await new PostgreSqlContainer(PGVECTOR_IMAGE)
      .withReuse()
      .start();

    this.pool = new Pool({
      host: this.container.getHost(),
      port: this.container.getPort(),
      user: this.container.getUsername(),
      password: this.container.getPassword(),
      database: this.container.getDatabase(),
    });

    this.db = drizzle(this.pool, { schema });
    await migrate(this.db, { migrationsFolder: MIGRATIONS_FOLDER });

    this.module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } })],
      providers: [
        { provide: DRIZZLE_DB, useValue: this.db },
        DrizzleTransactionContext,
        DrizzleTransactionService,
        ...providers,
      ],
    }).compile();
  }

  async stop(): Promise<void> {
    await this.pool.end();
    await this.module.close();
  }
}
