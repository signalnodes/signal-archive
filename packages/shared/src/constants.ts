import type { TrackingTier } from "./types";

/** Polling intervals per tracking tier (milliseconds) */
export const TIER_INTERVALS: Record<TrackingTier, number> = {
  priority: 5 * 60 * 1000, // 5 minutes
  standard: 15 * 60 * 1000, // 15 minutes
  low: 60 * 60 * 1000, // 60 minutes
};

/** Deletion check age thresholds — determines how often to re-check tweets */
export const DELETION_CHECK_THRESHOLDS = {
  /** Tweets < 7 days: check every cycle */
  RECENT_DAYS: 7,
  /** Tweets 7-30 days: check every 4th cycle (~20 min) */
  MEDIUM_DAYS: 30,
  MEDIUM_CYCLE_DIVISOR: 4,
  /** Tweets 30-90 days: check every 12th cycle (~1 hour) */
  OLD_DAYS: 90,
  OLD_CYCLE_DIVISOR: 12,
  /** Tweets > 90 days: check every 84th cycle (~7 hours) */
  ARCHIVE_CYCLE_DIVISOR: 84,
} as const;

/** BullMQ queue names */
export const QUEUE_NAMES = {
  INGESTION_PRIORITY: "ingestion-priority",
  INGESTION_STANDARD: "ingestion-standard",
  INGESTION_LOW: "ingestion-low",
  DELETION_CHECK: "deletion-check",
  HCS_SUBMIT: "hcs-submit",
  MEDIA_ARCHIVE: "media-archive",
} as const;

/** Jitter factor for anti-detection (±30%) */
export const JITTER_FACTOR = 0.3;
