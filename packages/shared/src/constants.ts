import type { TrackingTier } from "./types";

/** Polling intervals per tracking tier (milliseconds) */
export const TIER_INTERVALS: Record<TrackingTier, number> = {
  priority: 30 * 60 * 1000, // 30 minutes
  standard: 2 * 60 * 60 * 1000, // 2 hours
  low: 6 * 60 * 60 * 1000, // 6 hours
};

/** Deletion check age thresholds — determines how often to re-check tweets */
export const DELETION_CHECK_THRESHOLDS = {
  /** Tweets < 7 days: check every cycle */
  RECENT_DAYS: 7,
  /** Tweets 7-30 days: check every 4th cycle (~1 hour) */
  MEDIUM_DAYS: 30,
  MEDIUM_CYCLE_DIVISOR: 4,
  /** Tweets 30-90 days: check every 12th cycle (~3 hours) */
  OLD_DAYS: 90,
  OLD_CYCLE_DIVISOR: 12,
  /** Tweets > 90 days: skip entirely (too old to be worth checking) */
  ARCHIVE_CYCLE_DIVISOR: 0,
} as const;

/** BullMQ queue names */
export const QUEUE_NAMES = {
  INGESTION: "ingestion",
  DELETION_CHECK: "deletion-check",
  HCS_SUBMIT: "hcs-submit",
  MEDIA_ARCHIVE: "media-archive",
} as const;

/** BullMQ job priorities per tracking tier (lower number = higher priority) */
export const TIER_PRIORITIES: Record<TrackingTier, number> = {
  priority: 1,
  standard: 5,
  low: 10,
};

/** Jitter factor for anti-detection (±30%) */
export const JITTER_FACTOR = 0.3;

/** Max tweets to check per deletion-check cycle */
export const DELETION_CHECK_BATCH_SIZE = 100;

/** Mass deletion detection thresholds */
export const MASS_DELETION = {
  /** Minimum deletions within the window to flag as a mass deletion event */
  THRESHOLD: 5,
  /** Rolling window size in hours */
  WINDOW_HOURS: 1,
} as const;
