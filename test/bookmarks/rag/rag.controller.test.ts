import { TestBed } from '@automock/jest';
import { RAGController } from '../../../src/bookmarks/rag/rag.controller';
import { RAGService } from '../../../src/bookmarks/rag/rag.service';
import type { AskResponseDto } from '../../../src/bookmarks/dto/ask-response.dto';
import type { AskQuestionDto } from '../../../src/bookmarks/dto/ask-question.dto';

describe('RAGController Unit Test', () => {
  let sut: RAGController;
  let ragService: jest.Mocked<RAGService>;

  const QUESTION = 'How does Kafka handle message ordering across partitions?';
  const DTO: AskQuestionDto = { question: QUESTION };
  const RESPONSE: AskResponseDto = {
    answer: 'Kafka preserves order within a single partition using sequential offsets.',
  };

  beforeAll(() => {
    const { unit, unitRef } = TestBed.create(RAGController).compile();
    sut = unit;
    ragService = unitRef.get(RAGService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('Given ask, When called', () => {
    describe('And RAGService resolves with an answer', () => {
      test('Then it returns the AskResponseDto from the service', async () => {
        ragService.ask.mockResolvedValue(RESPONSE);

        const result = await sut.ask(DTO);

        expect(result).toStrictEqual(RESPONSE);
      });

      test('Then it delegates to RAGService with the question string only', async () => {
        ragService.ask.mockResolvedValue(RESPONSE);

        await sut.ask(DTO);

        expect(ragService.ask).toHaveBeenCalledWith(QUESTION);
        expect(ragService.ask).toHaveBeenCalledTimes(1);
      });
    });

    describe('And RAGService rejects', () => {
      test('Then it propagates the error to the caller', async () => {
        const error = new Error('upstream failure');
        ragService.ask.mockRejectedValueOnce(error);

        await expect(sut.ask(DTO)).rejects.toThrow('upstream failure');
      });
    });
  });
});
