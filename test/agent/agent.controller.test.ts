import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AgentController } from '../../src/agent/agent.controller';
import { RunAgentCommand } from '../../src/agent/commands/run-agent.command';

const QUESTION = 'What do I know about Kafka partitioning?';

const AGENT_RESPONSE = {
  answer: 'Kafka achieves parallelism by assigning one partition per consumer in a group.',
  truncated: false,
  toolCallTrace: [
    { iteration: 1, toolName: 'searchBookmarks', args: { query: 'Kafka partitioning' }, result: { found: 1, bookmarks: [] } },
  ],
};

describe('AgentController Supertest', () => {
  let app: INestApplication;
  let commandBus: jest.Mocked<CommandBus>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [{ provide: CommandBus, useValue: { execute: jest.fn() } }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    commandBus = module.get(CommandBus);
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  describe('Given POST /agent/run', () => {
    describe('When called with a valid question', () => {
      test('Then it returns 201 with the agent response and dispatches RunAgentCommand', async () => {
        commandBus.execute.mockResolvedValue(AGENT_RESPONSE);

        const res = await request(app.getHttpServer())
          .post('/agent/run')
          .send({ question: QUESTION })
          .expect(201);

        expect(res.body).toEqual(AGENT_RESPONSE);
        expect(commandBus.execute).toHaveBeenCalledWith(new RunAgentCommand(QUESTION));
      });
    });

    describe('When called with a missing question', () => {
      test('Then it returns 400', async () => {
        await request(app.getHttpServer()).post('/agent/run').send({}).expect(400);
      });
    });

    describe('When called with an empty question', () => {
      test('Then it returns 400', async () => {
        await request(app.getHttpServer()).post('/agent/run').send({ question: '' }).expect(400);
      });
    });
  });
});
