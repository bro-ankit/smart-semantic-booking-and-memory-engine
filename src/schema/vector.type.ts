import { customType } from 'drizzle-orm/pg-core';

// Pre-allocates the result array once at known size, then fills it with
// unary + conversion instead of Number(). Avoids the double-allocation from
// split(',').map(Number) which creates N string objects that must be GC'd.
// See docs/decisions/001-vector-parser-optimization.md
//
// NOTE: pgvector can emit scientific notation (e.g. 1.23e-7) for very small
// values. The unary + operator handles this correctly; a hand-rolled char-code
// loop would not without additional complexity.
export function toVectorDriverString(value: number[]): string {
  return `[${value.join(',')}]`;
}

export function parseVectorString(raw: string): number[] {
  const inner = raw.slice(1, -1);
  if (!inner) return [];
  const parts = inner.split(',');
  const result = new Array<number>(parts.length);
  for (let i = 0; i < parts.length; i++) {
    result[i] = +parts[i];
  }
  return result;
}

// Factory so each embedding model gets its own correctly-typed column
// instead of one hardcoded 768-dim constant constraining the whole schema.
// See docs/decisions/002-vector-column-factory.md
export type VectorColumnConfig = {
  dataType: () => string;
  toDriver: (value: number[]) => string;
  fromDriver: (value: string) => number[];
};

export function buildVectorConfig(dimensions: number): VectorColumnConfig {
  return {
    dataType: () => `vector(${dimensions})`,
    toDriver: toVectorDriverString,
    fromDriver: parseVectorString,
  };
}

export function createVectorType(dimensions: number) {
  return customType<{ data: number[]; driverData: string }>(
    buildVectorConfig(dimensions),
  );
}

export const GEMINI_EMBEDDING_DIMENSIONS = 768 as const;
export const OPENAI_EMBEDDING_DIMENSIONS = 1536 as const;

export const getGeminiVector = createVectorType(GEMINI_EMBEDDING_DIMENSIONS);
