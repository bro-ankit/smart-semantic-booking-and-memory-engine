import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE_DB } from '../database/database.constants';
import { DrizzleTransactionContext } from '../database/drizzle-transaction.context';
import type { DrizzleDb } from '../database/database.module';
import { todosTable, type TodoInsert } from '../schema/todos.schema';

@Injectable()
export class TodosRepository {
  constructor(
    @InjectPinoLogger(TodosRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) {}

  async insertMany(todos: TodoInsert[]): Promise<void> {
    if (todos.length === 0) return;
    this.logger.debug({ count: todos.length }, 'Inserting todos');
    const client = this.txContext.getClient(this.db);
    await client.insert(todosTable).values(todos);
  }
}
