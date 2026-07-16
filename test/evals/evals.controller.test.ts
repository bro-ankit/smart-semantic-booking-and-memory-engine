import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { RunEvalsCommand } from '../../src/evals/commands/run-evals.command';
import { EvalsController } from '../../src/evals/evals.controller';

const CREATED_AT_ISO = '2026-05-29T00:00:00.000Z';
const CREATED_AT = new Date(CREATED_AT_ISO);

const SUMMARY = {
  totalCases: 2,
  avgRelevance: 0.85,
  avgFaithfulness: 0.9,
  weakCases: [],
  runs: [
    {
      id: 'run-uuid-001',
      goldenQuestion: 'What are Kafka consumer groups?',
      relevanceScore: 0.85,
      faithfulnessScore: 0.9,
      reasoning: 'Answer covered partition assignment and rebalancing.',
      createdAt: CREATED_AT,
    },
    {
      id: 'run-uuid-002',
      goldenQuestion: 'How does pgvector work?',
      relevanceScore: 0.85,
      faithfulnessScore: 0.9,
      reasoning: 'Answer explained cosine distance and HNSW index.',
      createdAt: CREATED_AT,
    },
  ],
};

const SUMMARY_BODY = {
  ...SUMMARY,
  runs: SUMMARY.runs.map((r) => ({ ...r, createdAt: CREATED_AT_ISO })),
};

describe('EvalsController Supertest', () => {
  let app: INestApplication;
  let commandBus: jest.Mocked<CommandBus>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvalsController],
      providers: [{ provide: CommandBus, useValue: { execute: jest.fn() } }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    commandBus = module.get(CommandBus);
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  describe('Given POST /evals/run', () => {
    describe('When called', () => {
      test('Then it returns 201 with the eval summary and dispatches RunEvalsCommand', async () => {
        commandBus.execute.mockResolvedValue(SUMMARY);

        const res = await request(app.getHttpServer()).post('/evals/run').expect(201);

        expect(res.body).toEqual(SUMMARY_BODY);
        expect(commandBus.execute).toHaveBeenCalledWith(new RunEvalsCommand());
      });
    });
  });
});
