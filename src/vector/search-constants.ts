/** Minimum cosine similarity to include a result (filters noise) */
export const MIN_SIMILARITY = 0.35;

/** Maximum chunks returned per video (prevents single video dominating) */
export const MAX_PER_VIDEO = 2;

/** Default number of final results returned from the pipeline */
export const DEFAULT_RESULT_LIMIT = 8;

/** Fetch multiplier — retrieve N * limit candidates before reranking */
export const RETRIEVAL_MULTIPLIER = 3;

/** Extra results per query to compensate for deduplication across parallel queries */
export const PER_QUERY_BUFFER = 2;

/** Confidence indicators for search result display */
export const CONFIDENCE_ICON = {
  high: "●",
  medium: "◐",
  low: "○",
} as const;
