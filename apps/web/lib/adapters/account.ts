import type { AccountCategory, TrackingTier } from "@taa/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrackingMode = "FULL_ARCHIVE" | "IDENTITY_ONLY";

export interface AccountUI {
  stableUserId: string;       // twitter_id — stable even if handle changes
  currentHandle: string;
  displayName?: string;
  category: AccountCategory | string;
  trackingTier: TrackingTier | string;
  trackingMode: TrackingMode;
  observedSince: string;       // ISO — tracked_accounts.created_at
  metadata?: {
    createdRegion?: string;    // not currently captured; omit from UI if absent
    xAccountCreatedAt?: string;
  };
  stats: {
    // handleChanges intentionally omitted — not tracked yet.
    // Do not render "0". Omit the metric entirely until data exists.
    statements?: number;       // null/undefined for IDENTITY_ONLY
    deletions?: number;        // null/undefined for IDENTITY_ONLY
  };
}

export type EventType =
  | "STATEMENT_CAPTURED"
  | "STATEMENT_DELETED"
  | "HANDLE_CHANGED"      // not yet sourced — reserved for future
  | "METADATA_CHANGED"    // not yet sourced — reserved for future
  | "ATTESTED";

export interface EventUI {
  id: string;
  type: EventType;
  timestamp: string; // ISO
  summary: string;
  proof?: {
    hash?: string;
    topicId?: string;
    transactionId?: string;
    proofUrl?: string;   // /tweet/[id] or /verify/[hash]
  };
}

// ---------------------------------------------------------------------------
// Row shapes expected from DB queries (minimal — only what adapters need)
// ---------------------------------------------------------------------------

interface TrackedAccountRow {
  twitterId: string;
  username: string;
  displayName: string | null;
  category: string;
  trackingTier: string;
  isActive: boolean;
  metadata: unknown;
  createdAt: Date;
}

interface StatsRow {
  tweetCount: number;
  deletionCount: number;
}

// ---------------------------------------------------------------------------
// toAccountUI — maps a DB row + stats into the AccountUI contract
// ---------------------------------------------------------------------------

export function toAccountUI(account: TrackedAccountRow, stats: StatsRow): AccountUI {
  const meta = account.metadata as Record<string, unknown> | null;

  // trackingMode: prefer explicit override in metadata, default all existing
  // accounts to FULL_ARCHIVE. Never derive from tracking_tier (that's frequency,
  // not scope).
  const trackingMode: TrackingMode =
    (meta?.trackingMode as TrackingMode | undefined) ?? "FULL_ARCHIVE";

  const isFullArchive = trackingMode === "FULL_ARCHIVE";

  return {
    stableUserId: account.twitterId,
    currentHandle: account.username,
    displayName: account.displayName ?? undefined,
    category: account.category,
    trackingTier: account.trackingTier,
    trackingMode,
    observedSince: account.createdAt.toISOString(),
    // createdRegion and xAccountCreatedAt are not currently ingested.
    // Only surface them if present in metadata; omit otherwise.
    metadata:
      meta?.createdRegion || meta?.xAccountCreatedAt
        ? {
            createdRegion: meta.createdRegion as string | undefined,
            xAccountCreatedAt: meta.xAccountCreatedAt as string | undefined,
          }
        : undefined,
    stats: {
      // IDENTITY_ONLY accounts skip statement/deletion counts entirely —
      // never run those queries, never render the metrics.
      statements: isFullArchive ? stats.tweetCount : undefined,
      deletions: isFullArchive ? stats.deletionCount : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// toEventUI helpers — one per source table
// ---------------------------------------------------------------------------

interface TweetRow {
  id: string;
  content: string;
  capturedAt: Date;
  contentHash: string;
  attestationTopicId?: string | null;
  attestationTransactionId?: string | null;
  attestationSequenceNumber?: number | null;
}

interface DeletionRow {
  id: string;
  tweetId: string | null;
  contentPreview: string | null;
  detectedAt: Date;
}

export function tweetToEvent(tweet: TweetRow): EventUI {
  const preview = tweet.content.slice(0, 80);
  const attested = !!tweet.attestationTransactionId;
  return {
    id: `tweet-${tweet.id}`,
    type: attested ? "ATTESTED" : "STATEMENT_CAPTURED",
    timestamp: tweet.capturedAt.toISOString(),
    summary: attested
      ? `${preview.length < tweet.content.length ? `${preview}…` : preview}`
      : (preview.length < tweet.content.length ? `${preview}…` : preview),
    proof: {
      hash: tweet.contentHash,
      topicId: tweet.attestationTopicId ?? undefined,
      transactionId: tweet.attestationTransactionId ?? undefined,
      proofUrl: `/tweet/${tweet.id}`,
    },
  };
}

export function deletionToEvent(deletion: DeletionRow): EventUI {
  const preview = deletion.contentPreview?.slice(0, 80) ?? "Content unavailable";
  return {
    id: `deletion-${deletion.id}`,
    type: "STATEMENT_DELETED",
    timestamp: deletion.detectedAt.toISOString(),
    summary: preview,
    proof: deletion.tweetId
      ? { proofUrl: `/tweet/${deletion.tweetId}` }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// mergeEvents — merges N recent events from each stream, sorts by timestamp desc,
// returns top maxItems. Application-layer merge; no SQL UNION.
// ---------------------------------------------------------------------------

export function mergeEvents(
  streams: EventUI[][],
  maxItems = 20
): EventUI[] {
  return streams
    .flat()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, maxItems);
}
