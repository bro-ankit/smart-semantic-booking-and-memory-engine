import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { BookmarksController } from '../../src/bookmarks/bookmarks.controller';
import { IngestBookmarkCommand } from '../../src/bookmarks/commands/ingest-bookmark.command';
import { GetPendingReviewQuery } from '../../src/bookmarks/review/get-pending-review.query';
import { ReviewBookmarkCommand } from '../../src/bookmarks/review/review-bookmark.command';

const BOOKMARK_ID = 'bookmark-uuid-001';
const ORIGINAL_URL = 'https://example.com/kafka-partitioning';
const CREATED_AT_ISO = '2026-05-29T00:00:00.000Z';
const CREATED_AT = new Date(CREATED_AT_ISO);

// Plain objects mirroring BookmarkResponseDto — if the DTO gains a new @Expose() field, these break and must be updated
const REVIEW_PENDING_DTO = {
  id: BOOKMARK_ID,
  originalUrl: ORIGINAL_URL,
  contentSummary: '',
  tags: [],
  status: 'REVIEW_PENDING',
  errorMessage: null,
  aiContentSummary: 'AI summary',
  aiTags: ['kafka'],
  aiActionItems: [],
  createdAt: CREATED_AT,
};
const COMPLETED_DTO = {
  id: BOOKMARK_ID,
  originalUrl: ORIGINAL_URL,
  contentSummary: 'Final summary',
  tags: ['kafka'],
  status: 'COMPLETED',
  errorMessage: null,
  aiContentSummary: '',
  aiTags: [],
  aiActionItems: [],
  createdAt: CREATED_AT,
};
const FAILED_DTO = {
  id: BOOKMARK_ID,
  originalUrl: ORIGINAL_URL,
  contentSummary: '',
  tags: [],
  status: 'FAILED',
  errorMessage: 'HUMAN_REJECTED',
  aiContentSummary: '',
  aiTags: [],
  aiActionItems: [],
  createdAt: CREATED_AT,
};
const PENDING_DTO = {
  id: BOOKMARK_ID,
  originalUrl: ORIGINAL_URL,
  contentSummary: '',
  tags: [],
  status: 'PENDING',
  errorMessage: null,
  aiContentSummary: '',
  aiTags: [],
  aiActionItems: [],
  createdAt: CREATED_AT,
};

// Serialized versions (Date → ISO string) for res.body assertions
const REVIEW_PENDING_BODY = { ...REVIEW_PENDING_DTO, createdAt: CREATED_AT_ISO };
const COMPLETED_BODY = { ...COMPLETED_DTO, createdAt: CREATED_AT_ISO };
const FAILED_BODY = { ...FAILED_DTO, createdAt: CREATED_AT_ISO };

describe('BookmarksController Supertest', () => {
  let app: INestApplication;
  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookmarksController],
      providers: [
        { provide: CommandBus, useValue: { execute: jest.fn() } },
        { provide: QueryBus, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    commandBus = module.get(CommandBus);
    queryBus = module.get(QueryBus);
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  // ─── POST /bookmarks ───────────────────────────────────────────────────────

  describe('Given POST /bookmarks', () => {
    describe('When called with rawText', () => {
      test('Then it returns 201 with a BookmarkResponseDto and no embedding field', async () => {
        commandBus.execute.mockResolvedValue(REVIEW_PENDING_DTO);

        const res = await request(app.getHttpServer())
          .post('/bookmarks')
          .send({ rawText: 'Kafka partitioning distributes data across brokers.' })
          .expect(201);

        expect(res.body).toEqual(REVIEW_PENDING_BODY);
        expect(commandBus.execute).toHaveBeenCalledWith(
          new IngestBookmarkCommand({ rawText: 'Kafka partitioning distributes data across brokers.' }),
        );
      });
    });

    describe('When called with a url', () => {
      test('Then it returns 201 and forwards the url to the command bus', async () => {
        commandBus.execute.mockResolvedValue(PENDING_DTO);

        await request(app.getHttpServer()).post('/bookmarks').send({ url: 'https://example.com/kafka' }).expect(201);

        expect(commandBus.execute).toHaveBeenCalledWith(
          new IngestBookmarkCommand({ url: 'https://example.com/kafka' }),
        );
      });
    });

    describe('When called with both rawText and url', () => {
      test('Then it returns 400', async () => {
        await request(app.getHttpServer())
          .post('/bookmarks')
          .send({ rawText: 'some text', url: 'https://example.com' })
          .expect(400);
      });
    });

    describe('When called with neither rawText nor url', () => {
      test('Then it returns 400', async () => {
        await request(app.getHttpServer()).post('/bookmarks').send({}).expect(400);
      });
    });

    describe('When called with a url missing a protocol', () => {
      test('Then it returns 400', async () => {
        await request(app.getHttpServer()).post('/bookmarks').send({ url: 'example.com/kafka' }).expect(400);
      });
    });

    describe('When called with unknown fields', () => {
      test('Then it returns 400 due to forbidNonWhitelisted', async () => {
        await request(app.getHttpServer())
          .post('/bookmarks')
          .send({ rawText: 'some text', unknownField: 'bad' })
          .expect(400);
      });
    });
  });

  // ─── GET /bookmarks/review ─────────────────────────────────────────────────

  describe('Given GET /bookmarks/review', () => {
    describe('When bookmarks are awaiting review', () => {
      test('Then it returns 200 with the full DTO array and no embedding field', async () => {
        queryBus.execute.mockResolvedValue([REVIEW_PENDING_DTO]);

        const res = await request(app.getHttpServer()).get('/bookmarks/review').expect(200);

        expect(res.body).toEqual([REVIEW_PENDING_BODY]);
        expect(queryBus.execute).toHaveBeenCalledWith(new GetPendingReviewQuery());
      });
    });

    describe('When no bookmarks are awaiting review', () => {
      test('Then it returns 200 with an empty array', async () => {
        queryBus.execute.mockResolvedValue([]);
        const res = await request(app.getHttpServer()).get('/bookmarks/review').expect(200);
        expect(res.body).toEqual([]);
      });
    });
  });

  // ─── PATCH /bookmarks/:id/review ──────────────────────────────────────────

  describe('Given PATCH /bookmarks/:id/review', () => {
    describe('When approved: true with edits', () => {
      test('Then it returns 200 with the completed DTO and forwards the exact command to the command bus', async () => {
        commandBus.execute.mockResolvedValue(COMPLETED_DTO);

        const res = await request(app.getHttpServer())
          .patch(`/bookmarks/${BOOKMARK_ID}/review`)
          .send({ approved: true, editedSummary: 'Better summary.', editedTags: ['kafka'] })
          .expect(200);

        expect(res.body).toEqual(COMPLETED_BODY);
        expect(commandBus.execute).toHaveBeenCalledWith(
          new ReviewBookmarkCommand(BOOKMARK_ID, {
            approved: true,
            editedSummary: 'Better summary.',
            editedTags: ['kafka'],
          }),
        );
      });
    });

    describe('When approved: false', () => {
      test('Then it returns 200 with the failed DTO', async () => {
        commandBus.execute.mockResolvedValue(FAILED_DTO);

        const res = await request(app.getHttpServer())
          .patch(`/bookmarks/${BOOKMARK_ID}/review`)
          .send({ approved: false })
          .expect(200);

        expect(res.body).toEqual(FAILED_BODY);
      });
    });

    describe('When the approved field is missing', () => {
      test('Then it returns 400', async () => {
        await request(app.getHttpServer()).patch(`/bookmarks/${BOOKMARK_ID}/review`).send({}).expect(400);
      });
    });

    describe('When unknown fields are present', () => {
      test('Then it returns 400 due to forbidNonWhitelisted', async () => {
        await request(app.getHttpServer())
          .patch(`/bookmarks/${BOOKMARK_ID}/review`)
          .send({ approved: true, hackyField: 'bad' })
          .expect(400);
      });
    });
  });
});
