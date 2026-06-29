import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DRIZZLE_DB } from '../database/database.constants';
import { DrizzleTransactionContext } from '../database/drizzle-transaction.context';
import type { DrizzleDb } from '../database/database.module';
import { correctionsTable, type CorrectionInsert, type CorrectionSelect } from '../schema/corrections.schema';

@Injectable()
export class CorrectionsRepository {
  constructor(
    @InjectPinoLogger(CorrectionsRepository.name) private readonly logger: PinoLogger,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly txContext: DrizzleTransactionContext,
  ) { }

  async insert(data: CorrectionInsert): Promise<CorrectionSelect> {
    this.logger.debug({ bookmarkId: data.bookmarkId }, 'Inserting correction record');
    const client = this.txContext.getClient(this.db);
    const [result] = await client.insert(correctionsTable).values(data).returning();
    return result;
  }
}
