export const SEARCH_DEFAULTS = {
  TOP_K: 3,
  // How many candidates each retriever fetches before RRF fusion
  CANDIDATE_K: 20,
  // How many RRF-fused candidates get hydrated and passed to the cross-encoder reranker
  RERANK_POOL_K: 10,
  // Cosine distance threshold: 0 = identical, 2 = opposite.
  // Reject results with distance > 0.5 (similarity < 0.75).
  MAX_DISTANCE: 0.5,
} as const;
