/** AI severity scoring types and constants */

export interface ScoringContext {
  username: string;
  displayName: string | null;
  category: string;
  subcategory: string | null;
  content: string;
  postedAt: string; // ISO 8601
  tweetAgeHours: number;
  tweetType: string; // tweet | reply | retweet | quote
  hasMedia: boolean;
}

export interface ScoringResult {
  severity: number; // 1-10
  categoryTags: string[];
  reasoning: string;
  confidence: number; // 0.0-1.0
  model: string; // e.g. "claude-3-5-haiku-20241022" or "heuristic-v1"
  scoredAt: string; // ISO 8601
  latencyMs: number;
}

/** Allowed category tags for AI-scored deletions */
export const SEVERITY_CATEGORY_TAGS = [
  "legal_obligation",
  "market_relevant",
  "policy_reversal",
  "contradiction",
  "threat_or_violence",
  "evidence_destruction",
  "corruption_signal",
  "pump_and_dump",
  "mundane",
  "typo_correction",
  "opinion_shift",
  "coordination_signal",
  "records_act_violation",
  "heuristic_scored",
] as const;

export type SeverityCategoryTag = (typeof SEVERITY_CATEGORY_TAGS)[number];

/** Account categories that elevate severity (public officials with legal obligations) */
export const HIGH_ACCOUNTABILITY_CATEGORIES = [
  "trump_family",
  "white_house",
  "political_appointee",
  "federal_agency",
  "congress",
] as const;

/** Account categories with moderate accountability */
export const MODERATE_ACCOUNTABILITY_CATEGORIES = [
  "wlfi",
  "crypto_industry",
  "crypto_caller",
] as const;
