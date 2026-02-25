import { createHash } from "node:crypto";
import type { CanonicalTweet } from "./types";
import { JITTER_FACTOR } from "./constants";

/**
 * Compute a SHA-256 hash of a canonical tweet representation.
 * Keys are sorted deterministically to ensure reproducible hashes.
 */
export function computeContentHash(tweet: CanonicalTweet): string {
  const sorted: CanonicalTweet = {
    author_id: tweet.author_id,
    content: tweet.content,
    media_urls: [...tweet.media_urls].sort(),
    posted_at: tweet.posted_at,
    tweet_id: tweet.tweet_id,
    tweet_type: tweet.tweet_type,
  };
  const canonical = JSON.stringify(sorted, Object.keys(sorted).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Apply jitter to an interval for anti-detection.
 * Returns a value within ±JITTER_FACTOR of the base interval.
 */
export function applyJitter(baseMs: number): number {
  const jitter = 1 + (Math.random() * 2 - 1) * JITTER_FACTOR;
  return Math.round(baseMs * jitter);
}
