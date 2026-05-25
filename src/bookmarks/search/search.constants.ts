export const SEARCH_DEFAULTS = {
  TOP_K: 3,
  // Cosine distance threshold: 0 = identical, 2 = opposite.
  // Reject results with distance > 0.5 (similarity < 0.75).
  MAX_DISTANCE: 0.5,
} as const;
