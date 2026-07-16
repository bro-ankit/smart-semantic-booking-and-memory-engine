import { TestBed } from '@automock/jest';

import { AiUsageContextService } from '../../src/metrics/ai-usage-context.service';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('AiUsageContextService Unit Test', () => {
  let sut: AiUsageContextService;

  beforeAll(() => {
    const { unit } = TestBed.create(AiUsageContextService).compile();
    sut = unit;
  });

  describe('Given getOperation, When called outside any run()', () => {
    test('Then it returns undefined', () => {
      expect(sut.getOperation()).toBeUndefined();
    });
  });

  describe('Given run, When the callback reads the operation synchronously', () => {
    test('Then it sees the tagged operation', () => {
      const seen = sut.run({ operation: 'RAG_ASK' }, () => sut.getOperation());
      expect(seen).toBe('RAG_ASK');
    });
  });

  describe('Given run, When the callback reads the operation after an await', () => {
    test('Then the operation is still available (ALS survives async boundaries)', async () => {
      const seen = await sut.run({ operation: 'AGENT_TURN' }, async () => {
        await wait(5);
        return sut.getOperation();
      });

      expect(seen).toBe('AGENT_TURN');
    });
  });

  describe('Given run, When a nested async function call reads the operation', () => {
    test('Then the operation propagates through the call stack without being passed explicitly', async () => {
      const readDeep = async () => {
        await wait(1);
        return sut.getOperation();
      };

      const seen = await sut.run({ operation: 'EVAL_JUDGE' }, () => readDeep());

      expect(seen).toBe('EVAL_JUDGE');
    });
  });

  describe('Given two concurrent run() calls with different operations', () => {
    test('Then each sees only its own operation, with no cross-talk', async () => {
      const runOne = sut.run({ operation: 'ENRICHMENT' }, async () => {
        await wait(10);
        return sut.getOperation();
      });
      const runTwo = sut.run({ operation: 'RAG_ASK' }, async () => {
        await wait(5);
        return sut.getOperation();
      });

      const [resultOne, resultTwo] = await Promise.all([runOne, runTwo]);

      expect(resultOne).toBe('ENRICHMENT');
      expect(resultTwo).toBe('RAG_ASK');
    });
  });

  describe('Given runIterable, When consuming a source async iterable', () => {
    test('Then it yields the source values unchanged', async () => {
      async function* source() {
        yield 'a';
        yield 'b';
      }

      const seen: string[] = [];
      for await (const value of sut.runIterable({ operation: 'RAG_ASK' }, source())) {
        seen.push(value);
      }

      expect(seen).toEqual(['a', 'b']);
    });

    test('Then the operation is available inside the source across its own internal awaits, at every step', async () => {
      // Mirrors GeminiClient.generateTextStream: an await happens *inside* each
      // resumption, between yields — this is exactly the shape runIterable exists for.
      async function* source() {
        await wait(1);
        yield sut.getOperation();
        await wait(1);
        yield sut.getOperation();
      }

      const seen: Array<string | undefined> = [];
      for await (const value of sut.runIterable({ operation: 'AGENT_TURN' }, source())) {
        seen.push(value);
      }

      expect(seen).toEqual(['AGENT_TURN', 'AGENT_TURN']);
    });

    test('Then the operation is not visible before the iterable starts or after it is fully drained', async () => {
      expect(sut.getOperation()).toBeUndefined();

      async function* source() {
        yield 'only-value';
      }

      for await (const _value of sut.runIterable({ operation: 'EVAL_JUDGE' }, source())) {
        // drain
      }

      expect(sut.getOperation()).toBeUndefined();
    });
  });
});
