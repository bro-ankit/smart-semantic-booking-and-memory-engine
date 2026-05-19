export const GEMINI_CLIENT = Symbol('GEMINI_CLIENT');

export const GEMINI_ERRORS = {
  API_CALL_FAILED: 'Gemini API call failed',
  NON_JSON_RESPONSE: 'Gemini returned non-JSON response',
} as const;