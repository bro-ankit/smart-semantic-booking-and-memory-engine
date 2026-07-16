import {
  buildVectorConfig,
  GEMINI_EMBEDDING_DIMENSIONS,
  OPENAI_EMBEDDING_DIMENSIONS,
  parseVectorString,
  toVectorDriverString,
} from '../../src/schema/vector.type';

describe('Given parseVectorString, When called', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('And input is a standard pgvector string', () => {
    test('Then it returns the correct number array', () => {
      expect(parseVectorString('[0.1,0.2,0.3]')).toEqual([0.1, 0.2, 0.3]);
    });
  });

  describe('And input is an empty vector string', () => {
    test('Then it returns an empty array', () => {
      expect(parseVectorString('[]')).toEqual([]);
    });
  });

  describe('And input is a single-element vector', () => {
    test('Then it returns a one-element array', () => {
      expect(parseVectorString('[0.5]')).toEqual([0.5]);
    });
  });

  describe('And input contains negative values', () => {
    test('Then it preserves the sign on each element', () => {
      expect(parseVectorString('[-0.1,-0.9,0.5]')).toEqual([-0.1, -0.9, 0.5]);
    });
  });

  describe('And input contains scientific notation emitted by pgvector for near-zero values', () => {
    const RAW = '[1.23e-7,4.56e-10]';

    test('Then it parses each element without loss of precision', () => {
      const result = parseVectorString(RAW);

      expect(result[0]).toBeCloseTo(1.23e-7);
      expect(result[1]).toBeCloseTo(4.56e-10);
    });
  });

  describe('And input is a full 768-dimension vector', () => {
    const DIMS = 768;
    const RAW = `[${new Array(DIMS).fill('0.1').join(',')}]`;

    test('Then the result array length matches the dimension count', () => {
      expect(parseVectorString(RAW)).toHaveLength(DIMS);
    });
  });

  describe('And input contains high-precision floats', () => {
    const RAW = '[0.123456789,0.987654321]';

    test('Then precision is maintained to 8 decimal places', () => {
      const result = parseVectorString(RAW);

      expect(result[0]).toBeCloseTo(0.123456789, 8);
      expect(result[1]).toBeCloseTo(0.987654321, 8);
    });
  });
});

describe('Given toVectorDriverString, When called', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('And input is a standard float array', () => {
    test('Then it returns the pgvector bracket-format string', () => {
      expect(toVectorDriverString([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]');
    });
  });

  describe('And input is an empty array', () => {
    test('Then it returns empty brackets', () => {
      expect(toVectorDriverString([])).toBe('[]');
    });
  });

  describe('And input is a single-element array', () => {
    test('Then it wraps the single value in brackets', () => {
      expect(toVectorDriverString([0.5])).toBe('[0.5]');
    });
  });

  describe('And output is passed back through parseVectorString', () => {
    const ORIGINAL = [0.1, 0.2, -0.3, 0.999];

    test('Then the round-trip produces the original values', () => {
      const roundTripped = parseVectorString(toVectorDriverString(ORIGINAL));
      expect(roundTripped).toEqual(ORIGINAL);
    });
  });
});

describe('Given buildVectorConfig, When called with a dimension count', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('And dimensions is 768', () => {
    const CONFIG = buildVectorConfig(768);

    test('Then dataType() returns vector(768)', () => {
      expect(CONFIG.dataType()).toBe('vector(768)');
    });

    test('Then toDriver serialises a number array to pgvector format', () => {
      expect(CONFIG.toDriver([0.1, 0.2])).toBe('[0.1,0.2]');
    });

    test('Then fromDriver parses a pgvector string to a number array', () => {
      expect(CONFIG.fromDriver('[0.1,0.2]')).toEqual([0.1, 0.2]);
    });
  });

  describe('And dimensions is 1536', () => {
    test('Then dataType() returns vector(1536)', () => {
      expect(buildVectorConfig(1536).dataType()).toBe('vector(1536)');
    });
  });

  describe('And two configs are created with different dimensions', () => {
    const CONFIG_768 = buildVectorConfig(768);
    const CONFIG_1536 = buildVectorConfig(1536);

    test('Then each config independently captures its own dimension in the closure', () => {
      expect(CONFIG_768.dataType()).toBe('vector(768)');
      expect(CONFIG_1536.dataType()).toBe('vector(1536)');
    });
  });
});

describe('Given embedding dimension constants, When imported', () => {
  describe.each([
    { name: 'GEMINI_EMBEDDING_DIMENSIONS', value: GEMINI_EMBEDDING_DIMENSIONS, expected: 768 },
    { name: 'OPENAI_EMBEDDING_DIMENSIONS', value: OPENAI_EMBEDDING_DIMENSIONS, expected: 1536 },
  ])('And constant is $name', ({ value, expected }) => {
    test(`Then its value is ${String(expected)}`, () => {
      expect(value).toBe(expected);
    });
  });
});
