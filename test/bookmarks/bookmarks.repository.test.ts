import { BookmarksRepository } from '../../src/bookmarks/bookmarks.repository';
import { DrizzleTransactionService } from '../../src/database/drizzle-transaction.service';
import { bookmarksTable } from '../../src/schema/bookmarks.schema';
import { DrizzleTestEnvironment } from '../helpers/drizzle-test-environment';

// Cosine distance measures angle, not magnitude — vectors must differ in direction.
// A: weight on first half. B: weight on second half. Query matches A's direction.
const EMBEDDING_A = [...new Array(384).fill(1.0), ...new Array(384).fill(0.0)];
const EMBEDDING_B = [...new Array(384).fill(0.0), ...new Array(384).fill(1.0)];
const QUERY_EMBEDDING = [...new Array(384).fill(0.99), ...new Array(384).fill(0.01)];

const BOOKMARK_A = {
  originalUrl: 'https://example.com/nestjs-guide',
  contentSummary: 'Comprehensive guide to NestJS dependency injection.',
  tags: ['nestjs', 'di', 'typescript'],
  embedding: EMBEDDING_A,
  status: 'COMPLETED' as const,
};

const BOOKMARK_B = {
  originalUrl: 'https://example.com/kafka-guide',
  contentSummary: 'Kafka partitioning strategies for high-throughput systems.',
  tags: ['kafka', 'streaming'],
  embedding: EMBEDDING_B,
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
        const result = await sut.insert(BOOKMARK_A);

        expect(result.id).toBeDefined();
        expect(result.originalUrl).toBe(BOOKMARK_A.originalUrl);
        expect(result.contentSummary).toBe(BOOKMARK_A.contentSummary);
        expect(result.tags).toEqual(BOOKMARK_A.tags);
        expect(result.status).toBe('COMPLETED');
        expect(result.createdAt).toBeInstanceOf(Date);
      });

      test('Then exactly one row exists in the database after insert', async () => {
        await sut.insert(BOOKMARK_A);

        const rows = await env.db.select().from(bookmarksTable);
        expect(rows).toHaveLength(1);
      });
    });

    describe('And a transaction is active via DrizzleTransactionContext', () => {
      test('Then the insert uses the transaction and rolls back on error', async () => {
        const txService = env.module.get(DrizzleTransactionService);

        await expect(
          txService.execute(async () => {
            await sut.insert(BOOKMARK_A);
            throw new Error('forced rollback');
          }),
        ).rejects.toThrow('forced rollback');

        const rows = await env.db.select().from(bookmarksTable);
        expect(rows).toHaveLength(0);
      });
    });
  });

  describe('Given updateStatus, When called', () => {
    describe('And the bookmark exists and a new status is provided', () => {
      test('Then it updates the status field in the database', async () => {
        const bookmark = await sut.insert({ originalUrl: 'https://example.com', status: 'PENDING' });

        await sut.updateStatus(bookmark.id, 'PROCESSING');

        const [row] = await env.db.select().from(bookmarksTable);
        expect(row!.status).toBe('PROCESSING');
      });
    });

    describe('And an errorMessage is provided', () => {
      test('Then it persists the error message alongside the FAILED status', async () => {
        const bookmark = await sut.insert({ originalUrl: 'https://example.com', status: 'PENDING' });

        await sut.updateStatus(bookmark.id, 'FAILED', 'LLM timeout');

        const [row] = await env.db.select().from(bookmarksTable);
        expect(row!.status).toBe('FAILED');
        expect(row!.errorMessage).toBe('LLM timeout');
      });
    });

    describe('And no errorMessage is provided', () => {
      test('Then it leaves the existing errorMessage unchanged', async () => {
        const bookmark = await sut.insert({ originalUrl: 'https://example.com', status: 'PENDING' });
        await sut.updateStatus(bookmark.id, 'FAILED', 'first error');
        await sut.updateStatus(bookmark.id, 'PROCESSING');

        const [row] = await env.db.select().from(bookmarksTable);
        expect(row!.errorMessage).toBe('first error');
      });
    });
  });

  describe('Given updateEnrichment, When called', () => {
    describe('And enrichment data is provided', () => {
      test('Then it updates contentSummary, tags, embedding and status and returns the updated row', async () => {
        const bookmark = await sut.insert({ originalUrl: 'https://example.com', status: 'PROCESSING' });
        const newEmbedding = [...new Array(384).fill(0.5), ...new Array(384).fill(0.5)];

        const result = await sut.updateEnrichment(bookmark.id, {
          contentSummary: 'Updated summary',
          tags: ['tag-a', 'tag-b'],
          embedding: newEmbedding,
          status: 'COMPLETED',
        });

        expect(result.id).toBe(bookmark.id);
        expect(result.contentSummary).toBe('Updated summary');
        expect(result.tags).toEqual(['tag-a', 'tag-b']);
        expect(result.embedding).toEqual(newEmbedding);
        expect(result.status).toBe('COMPLETED');
      });

      test('Then the changes are persisted to the database', async () => {
        const bookmark = await sut.insert({ originalUrl: 'https://example.com', status: 'PROCESSING' });

        await sut.updateEnrichment(bookmark.id, {
          contentSummary: 'Persisted summary',
          tags: ['persisted'],
          embedding: EMBEDDING_A,
          status: 'COMPLETED',
        });

        const [row] = await env.db.select().from(bookmarksTable);
        expect(row!.contentSummary).toBe('Persisted summary');
        expect(row!.status).toBe('COMPLETED');
      });
    });
  });

  describe('Given findSimilar, When called', () => {
    describe('And two bookmarks with different embeddings exist', () => {
      test('Then it returns results ordered by cosine similarity — closest first', async () => {
        await sut.insert(BOOKMARK_A);
        await sut.insert(BOOKMARK_B);

        const results = await sut.findSimilar(QUERY_EMBEDDING, 2, 1.0);

        expect(results).toHaveLength(2);
        expect(results[0].originalUrl).toBe(BOOKMARK_A.originalUrl);
        expect(results[1].originalUrl).toBe(BOOKMARK_B.originalUrl);
      });

      test('Then limit is respected', async () => {
        await sut.insert(BOOKMARK_A);
        await sut.insert(BOOKMARK_B);

        const results = await sut.findSimilar(QUERY_EMBEDDING, 1, 1.0);

        expect(results).toHaveLength(1);
        expect(results[0].originalUrl).toBe(BOOKMARK_A.originalUrl);
      });
    });

    describe('And a bookmark has no embedding', () => {
      test('Then it is excluded from results', async () => {
        await sut.insert({ ...BOOKMARK_A, embedding: null });
        await sut.insert(BOOKMARK_B);

        const results = await sut.findSimilar(QUERY_EMBEDDING, 3, 1.0);

        expect(results).toHaveLength(1);
        expect(results[0].originalUrl).toBe(BOOKMARK_B.originalUrl);
      });
    });

    describe('And a bookmark exists but its distance exceeds maxDistance', () => {
      test('Then it is excluded from results', async () => {
        await sut.insert(BOOKMARK_A);

        // maxDistance of 0 excludes everything except an identical vector
        const results = await sut.findSimilar(QUERY_EMBEDDING, 3, 0.0);

        expect(results).toHaveLength(0);
      });
    });

    describe('And no bookmarks exist', () => {
      test('Then it returns an empty array', async () => {
        const results = await sut.findSimilar(QUERY_EMBEDDING, 3, 1.0);
        expect(results).toEqual([]);
      });
    });
  });

  describe('Given findByTag, When called', () => {
    describe('And a COMPLETED bookmark with the given tag exists', () => {
      test('Then it returns that bookmark', async () => {
        await sut.insert(BOOKMARK_A);

        const results = await sut.findByTag('nestjs');

        expect(results).toHaveLength(1);
        expect(results[0]!.originalUrl).toBe(BOOKMARK_A.originalUrl);
      });
    });

    describe('And the tag is passed with uppercase letters', () => {
      test('Then it normalises to lowercase and still finds the bookmark', async () => {
        await sut.insert(BOOKMARK_A);

        const results = await sut.findByTag('NestJS');

        expect(results).toHaveLength(1);
      });
    });

    describe('And multiple bookmarks share the same tag', () => {
      test('Then it returns all of them', async () => {
        // Both BOOKMARK_A and BOOKMARK_B exist but only BOOKMARK_B has 'kafka'
        await sut.insert(BOOKMARK_A);
        await sut.insert(BOOKMARK_B); // tags: ['kafka', 'streaming']

        const results = await sut.findByTag('kafka');

        expect(results).toHaveLength(1);
        expect(results[0]!.originalUrl).toBe(BOOKMARK_B.originalUrl);
      });
    });

    describe('And a bookmark with the tag exists but is not COMPLETED', () => {
      test('Then it is excluded from results', async () => {
        await sut.insert({ ...BOOKMARK_A, status: 'REVIEW_PENDING' });

        const results = await sut.findByTag('nestjs');

        expect(results).toHaveLength(0);
      });
    });

    describe('And no bookmark with the given tag exists', () => {
      test('Then it returns an empty array', async () => {
        await sut.insert(BOOKMARK_A);

        const results = await sut.findByTag('unknown-tag');

        expect(results).toHaveLength(0);
      });
    });
  });
});
