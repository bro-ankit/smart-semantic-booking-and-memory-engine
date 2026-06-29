import { CorrectionsRepository } from '../../src/bookmarks/corrections.repository';
import { BookmarksRepository } from '../../src/bookmarks/bookmarks.repository';
import { bookmarksTable } from '../../src/schema/bookmarks.schema';
import { correctionsTable } from '../../src/schema/corrections.schema';
import { DrizzleTestEnvironment } from '../helpers/drizzle-test-environment';
import { AssertUtils } from '../utils/assert.utils';

const BOOKMARK_SEED = {
  originalUrl: 'https://example.com/kafka-guide',
  contentSummary: 'Kafka partitioning strategies.',
  tags: ['kafka'],
  status: 'REVIEW_PENDING' as const,
  aiContentSummary: 'AI-generated Kafka summary.',
  aiTags: ['kafka', 'streaming'],
  aiActionItems: ['Read Kafka docs'],
};

describe('CorrectionsRepository IT', () => {
  const env = new DrizzleTestEnvironment();
  let sut: CorrectionsRepository;
  let bookmarksRepository: BookmarksRepository;

  beforeAll(async () => {
    await env.start([CorrectionsRepository, BookmarksRepository]);
    sut = env.module.get(CorrectionsRepository);
    bookmarksRepository = env.module.get(BookmarksRepository);
  }, 60_000);

  afterAll(() => env.stop());

  afterEach(async () => {
    await env.db.delete(correctionsTable);
    await env.db.delete(bookmarksTable);
  });

  describe('Given insert', () => {
    describe('When called with a valid correction including human edits', () => {
      test('Then it persists the correction and returns the full record', async () => {
        const bookmark = await bookmarksRepository.insert(BOOKMARK_SEED);

        const result = await sut.insert({
          bookmarkId: bookmark.id,
          aiSummary: BOOKMARK_SEED.aiContentSummary,
          humanSummary: 'Human-corrected summary.',
          aiTags: BOOKMARK_SEED.aiTags,
          humanTags: ['kafka', 'human-corrected'],
        });

        expect(result).toEqual({
          id: result.id,
          createdAt: result.createdAt,
          bookmarkId: bookmark.id,
          aiSummary: BOOKMARK_SEED.aiContentSummary,
          humanSummary: 'Human-corrected summary.',
          aiTags: BOOKMARK_SEED.aiTags,
          humanTags: ['kafka', 'human-corrected'],
        });
      });
    });

    describe('When called with no human edits (AI accepted as-is)', () => {
      test('Then it persists with null human fields', async () => {
        const bookmark = await bookmarksRepository.insert(BOOKMARK_SEED);

        const result = await sut.insert({
          bookmarkId: bookmark.id,
          aiSummary: BOOKMARK_SEED.aiContentSummary,
          humanSummary: null,
          aiTags: BOOKMARK_SEED.aiTags,
          humanTags: null,
        });

        expect(result).toEqual({
          id: result.id,
          createdAt: result.createdAt,
          bookmarkId: bookmark.id,
          aiSummary: BOOKMARK_SEED.aiContentSummary,
          humanSummary: null,
          aiTags: BOOKMARK_SEED.aiTags,
          humanTags: null,
        });
      });
    });

    describe('When the referenced bookmark does not exist', () => {
      test('Then it throws a PostgreSQL FK violation error (23503)', async () => {
        const action = () =>
          sut.insert({
            bookmarkId: '00000000-0000-0000-0000-000000000000',
            aiSummary: 'some summary',
            humanSummary: null,
            aiTags: ['tag'],
            humanTags: null,
          });

        await AssertUtils.assertDatabaseError(action, '23503');
      });
    });
  });
});
