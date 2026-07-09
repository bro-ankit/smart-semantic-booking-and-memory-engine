export const GEMINI_CLIENT = Symbol('GEMINI_CLIENT');

export const GEMINI_ERRORS = {
  API_CALL_FAILED: 'Gemini API call failed',
  NON_JSON_RESPONSE: 'Gemini returned non-JSON response',
} as const;

// Defaults; override via GEMINI_COST_INPUT_PER_MILLION / GEMINI_COST_OUTPUT_PER_MILLION env vars
export const GEMINI_COST_DEFAULTS = {
  INPUT: 0.30,
  OUTPUT: 1.00,
} as const;