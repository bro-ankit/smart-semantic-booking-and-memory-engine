import type { PinoLogger } from 'nestjs-pino';

import { EvalGoldenSetService } from '../../../src/evals/golden-set/eval-golden-set.service';

jest.mock('nestjs-pino', () => ({
  InjectPinoLogger: () => () => {},
  PinoLogger: jest.fn().mockImplementation(() => ({ debug: jest.fn() })),
}));

describe('EvalGoldenSetService Unit Test', () => {
  let sut: EvalGoldenSetService;

  beforeAll(() => {
    const logger = { debug: jest.fn() } as unknown as PinoLogger;
    sut = new EvalGoldenSetService(logger);
  });

  describe('Given load, When called', () => {
    test('Then it returns an array from evals/golden-set.json', () => {
      const result = sut.load();

      expect(Array.isArray(result)).toBe(true);
    });

    test('Then every item in the array has the required GoldenCase shape', () => {
      const result = sut.load();

      for (const item of result) {
        expect(typeof item.question).toBe('string');
        expect(item.question.length).toBeGreaterThan(0);
        expect(Array.isArray(item.expectedTopics)).toBe(true);
        expect(item.expectedTopics.length).toBeGreaterThan(0);
        expect('expectedSourceTag' in item).toBe(true);
      }
    });
  });
});
