import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE_DB } from '../database/database.constants';
import { DrizzleTransactionContext } from '../database/drizzle-transaction.context';
import type { DrizzleDb } from '../database/database.module';
import { bookmarksTable, type BookmarkInsert, type BookmarkSelect } from '../schema/bookmarks.schema';

@Injectable()
export class BookmarksRepository {
  constructor(
    @InjectPinoLogger(BookmarksRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) { }

  async insert(data: BookmarkInsert): Promise<BookmarkSelect> {
    this.logger.debug('Inserting bookmark');
    const client = this.txContext.getClient(this.db);
    const [result] = await client.insert(bookmarksTable).values(data).returning();
    return result;
  }
}
