import { TestBed } from '@automock/jest';
import { ConfigService } from '@nestjs/config';

import { RerankerService } from '../../../src/bookmarks/search/reranker.service';

const mockTokenizer = jest.fn();
const mockModel = jest.fn();

jest.mock('@huggingface/transformers', () => ({
  AutoTokenizer: { from_pretrained: jest.fn(() => Promise.resolve(mockTokenizer)) },
  AutoModelForSequenceClassification: { from_pretrained: jest.fn(() => Promise.resolve(mockModel)) },
}));

describe('RerankerService Unit Test', () => {
  let sut: RerankerService;

  const QUERY = 'How does Kafka handle message ordering across partitions?';

  beforeAll(async () => {
    const { unit } = TestBed.create(RerankerService)
      .mock(ConfigService)
      .using({ get: (_key: string, defaultValue?: unknown) => defaultValue })
      .compile();
    sut = unit;

    await sut.onModuleInit();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTokenizer.mockImplementation((query: string, opts: { text_pair: string }) => ({
      query,
      textPair: opts.text_pair,
    }));
  });

  describe('Given rerank, When called', () => {
    describe('And candidates score differently against the query', () => {
      test('Then it scores each candidate and returns them sorted by descending score', async () => {
        mockModel.mockImplementation((inputs: { textPair: string }) => {
          const score = inputs.textPair.includes('ordering') ? 5.7 : -1.6;
          return Promise.resolve({ logits: { data: [score] } });
        });

        const results = await sut.rerank(QUERY, [
          { id: 'id-1', text: 'Partitions are the unit of parallelism in Kafka.' },
          { id: 'id-2', text: 'Kafka guarantees ordering within a partition via sequential offsets.' },
        ]);

        expect(results).toEqual([
          { id: 'id-2', score: 5.7 },
          { id: 'id-1', score: -1.6 },
        ]);
      });
    });

    describe('And a single candidate is given', () => {
      test('Then it passes the query and the candidate text as a text_pair to the tokenizer', async () => {
        mockModel.mockResolvedValue({ logits: { data: [0] } });

        await sut.rerank(QUERY, [{ id: 'id-1', text: 'Kafka partitioning guide.' }]);

        expect(mockTokenizer).toHaveBeenCalledWith(
          QUERY,
          expect.objectContaining({ text_pair: 'Kafka partitioning guide.' }),
        );
      });
    });

    describe('And no candidates are given', () => {
      test('Then it returns an empty array without invoking the model', async () => {
        const results = await sut.rerank(QUERY, []);

        expect(results).toEqual([]);
        expect(mockModel).not.toHaveBeenCalled();
      });
    });
  });
});
