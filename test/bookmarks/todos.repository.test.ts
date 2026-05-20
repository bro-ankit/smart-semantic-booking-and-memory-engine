import { TodosRepository } from '../../src/bookmarks/todos.repository';
import { BookmarksRepository } from '../../src/bookmarks/bookmarks.repository';
import { bookmarksTable } from '../../src/schema/bookmarks.schema';
import { todosTable } from '../../src/schema/todos.schema';
import { DrizzleTestEnvironment } from '../helpers/drizzle-test-environment';

const BOOKMARK_DATA = {
  originalUrl: 'https://example.com/kafka-guide',
  contentSummary: 'A deep dive into Kafka partitioning internals.',
  tags: ['kafka', 'streaming'],
  embedding: new Array(768).fill(0.03),
  status: 'COMPLETED' as const,
};

describe('TodosRepository IT', () => {
  const env = new DrizzleTestEnvironment();
  let sut: TodosRepository;
  let bookmarksRepository: BookmarksRepository;

  beforeAll(async () => {
    await env.start([TodosRepository, BookmarksRepository]);
    sut = env.module.get(TodosRepository);
    bookmarksRepository = env.module.get(BookmarksRepository);
  }, 60_000);

  afterAll(() => env.stop());

  afterEach(async () => {
    await env.db.delete(bookmarksTable);
  });

  describe('Given insertMany, When called', () => {
    describe('And todos with valid bookmarkId are provided', () => {
      test('Then it persists all todos linked to the bookmark', async () => {
        const bookmark = await bookmarksRepository.insert(BOOKMARK_DATA);

        await sut.insertMany([
          { bookmarkId: bookmark.id, task: 'Read the Kafka docs' },
          { bookmarkId: bookmark.id, task: 'Set up local Kafka cluster' },
        ]);

        const rows = await env.db.select().from(todosTable);
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.task)).toEqual(
          expect.arrayContaining(['Read the Kafka docs', 'Set up local Kafka cluster']),
        );
        expect(rows.every((r) => r.bookmarkId === bookmark.id)).toBe(true);
      });
    });

    describe('And todos is empty', () => {
      test('Then it inserts nothing and the todos table remains empty', async () => {
        await bookmarksRepository.insert(BOOKMARK_DATA);

        await sut.insertMany([]);

        const rows = await env.db.select().from(todosTable);
        expect(rows).toHaveLength(0);
      });
    });

    describe('And todos cascade-delete when the parent bookmark is deleted', () => {
      test('Then deleting the bookmark removes all its todos', async () => {
        const bookmark = await bookmarksRepository.insert(BOOKMARK_DATA);
        await sut.insertMany([{ bookmarkId: bookmark.id, task: 'Task A' }]);

        await env.db.delete(bookmarksTable);

        const rows = await env.db.select().from(todosTable);
        expect(rows).toHaveLength(0);
      });
    });
  });
});
