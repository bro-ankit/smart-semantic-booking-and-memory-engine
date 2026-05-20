import { BookmarksRepository } from '../../src/bookmarks/bookmarks.repository';
import { bookmarksTable } from '../../src/schema/bookmarks.schema';
import { DrizzleTestEnvironment } from '../helpers/drizzle-test-environment';

const BOOKMARK_DATA = {
  originalUrl: 'https://example.com/nestjs-guide',
  contentSummary: 'Comprehensive guide to NestJS dependency injection.',
  tags: ['nestjs', 'di', 'typescript'],
  embedding: new Array(768).fill(0.02),
  status: 'COMPLETED' as const,
};

describe('BookmarksRepository IT', () => {
  const env = new DrizzleTestEnvironment();
  let sut: BookmarksRepository;

  beforeAll(async () => {
    await env.start([BookmarksRepository]);
    sut = env.module.get(BookmarksRepository);
  }, 60_000);

  afterAll(() => env.stop());

  afterEach(async () => {
    await env.db.delete(bookmarksTable);
  });

  describe('Given insert, When called', () => {
    describe('And valid bookmark data is provided', () => {
      test('Then it persists the bookmark and returns it with a generated id', async () => {
        const result = await sut.insert(BOOKMARK_DATA);

        expect(result.id).toBeDefined();
        expect(result.originalUrl).toBe(BOOKMARK_DATA.originalUrl);
        expect(result.contentSummary).toBe(BOOKMARK_DATA.contentSummary);
        expect(result.tags).toEqual(BOOKMARK_DATA.tags);
        expect(result.status).toBe('COMPLETED');
        expect(result.createdAt).toBeInstanceOf(Date);
      });

      test('Then exactly one row exists in the database after insert', async () => {
        await sut.insert(BOOKMARK_DATA);

        const rows = await env.db.select().from(bookmarksTable);
        expect(rows).toHaveLength(1);
      });
    });

    describe('And a transaction is active via DrizzleTransactionContext', () => {
      test('Then the insert uses the transaction and rolls back on error', async () => {
        const txService = env.module.get(
          (await import('../../src/database/drizzle-transaction.service')).DrizzleTransactionService,
        );

        await expect(
          txService.execute(async () => {
            await sut.insert(BOOKMARK_DATA);
            throw new Error('forced rollback');
          }),
        ).rejects.toThrow('forced rollback');

        const rows = await env.db.select().from(bookmarksTable);
        expect(rows).toHaveLength(0);
      });
    });
  });
});
