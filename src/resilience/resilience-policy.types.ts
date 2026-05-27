export type ResiliencePolicyOptions = {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  halfOpenAfter?: number;
  threshold?: number;
  minimumRps?: number;
  durationMs?: number;
};
