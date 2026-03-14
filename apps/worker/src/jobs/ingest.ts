import { Worker, Job } from "bullmq";
import { eq, inArray } from "drizzle-orm";
import { connection, hcsSubmitQueue, mediaArchiveQueue } from "../queues";
import {
  QUEUE_NAMES,
  computeContentHash,
  type CanonicalTweet,
  type TrackingTier,
} from "@taa/shared";
import { getDb, tweets, trackedAccounts } from "@taa/db";
import type { TweetProvider } from "../services/scraper";

export interface IngestJobData {
  accountId: string;
  username: string;
  twitterId: string;
  tier: TrackingTier;
}

// Only archive tweets posted on or after this date (reduces cost, keeps scope relevant)
const ARCHIVE_SINCE = process.env.ARCHIVE_SINCE
  ? new Date(process.env.ARCHIVE_SINCE)
  : new Date("2025-01-01T00:00:00Z");

async function processIngestion(
  job: Job<IngestJobData>,
  provider: TweetProvider
) {
  const { accountId, username, tier } = job.data;
  console.log(`[ingest] Processing @${username} (tier: ${tier})`);

  const db = getDb();

  // Fetch twitterId fresh from DB — job.data.twitterId may be stale from
  // when the repeatable job was first registered in BullMQ
  const account = await db.query.trackedAccounts.findFirst({
    where: eq(trackedAccounts.id, accountId),
    columns: { twitterId: true },
  });

  if (!account?.twitterId) {
    console.warn(`[ingest] @${username} has no twitterId, skipping`);
    return;
  }

  // Per-execution jitter — randomizes actual run time within the polling window
  // to avoid thundering herd when many accounts fire at the same scheduled moment
  await new Promise((r) => setTimeout(r, Math.random() * 5000));

  const scraped = await provider.fetchTweets(username, account.twitterId);
  let newCount = 0;
  let dupeCount = 0;
  let skippedCount = 0;

  const eligible = scraped.filter((t) => {
    if (t.postedAt < ARCHIVE_SINCE) { skippedCount++; return false; }
    return true;
  });

  // Batch dedup: single query for all tweet IDs instead of N individual queries
  const scrapedIds = eligible.map((t) => t.tweetId);
  const existingRows = scrapedIds.length > 0
    ? await db.select({ tweetId: tweets.tweetId }).from(tweets).where(inArray(tweets.tweetId, scrapedIds))
    : [];
  const existingSet = new Set(existingRows.map((r) => r.tweetId));

  for (const tweet of eligible) {
    if (existingSet.has(tweet.tweetId)) {
      dupeCount++;
      continue;
    }

    // Build canonical representation and hash
    const canonical: CanonicalTweet = {
      tweet_id: tweet.tweetId,
      author_id: tweet.authorId,
      content: tweet.content,
      posted_at: tweet.postedAt.toISOString(),
      media_urls: [...tweet.mediaUrls].sort(),
      tweet_type: tweet.tweetType,
    };
    const contentHash = computeContentHash(canonical);

    // Insert into DB — catch concurrent duplicate inserts gracefully
    let inserted: { id: string } | undefined;
    try {
      const rows = await db
        .insert(tweets)
        .values({
          tweetId: tweet.tweetId,
          accountId,
          authorId: tweet.authorId,
          content: tweet.content,
          rawJson: tweet,
          tweetType: tweet.tweetType,
          mediaUrls: tweet.mediaUrls,
          postedAt: tweet.postedAt,
          contentHash,
        })
        .returning({ id: tweets.id });
      inserted = rows[0];
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("unique") || msg.includes("duplicate")) {
        dupeCount++;
        continue;
      }
      throw e;
    }

    newCount++;

    // Queue HCS attestation
    await hcsSubmitQueue.add(`hcs:${tweet.tweetId}`, {
      dbId: inserted.id,
      tweetId: tweet.tweetId,
      authorId: tweet.authorId,
      contentHash,
      type: "tweet_attestation" as const,
      username,
      postedAt: tweet.postedAt.toISOString(),
    });

    // Queue media archival if media present
    if (tweet.mediaUrls.length > 0) {
      await mediaArchiveQueue.add(`media:${tweet.tweetId}`, {
        tweetId: tweet.tweetId,
        mediaUrls: tweet.mediaUrls,
      });
    }
  }

  console.log(
    `[ingest] Done @${username}: ${newCount} new, ${dupeCount} already seen, ${skippedCount} before cutoff`
  );
}

export function createIngestionWorker(provider: TweetProvider) {
  return new Worker(
    QUEUE_NAMES.INGESTION,
    (job: Job<IngestJobData>) => processIngestion(job, provider),
    { connection, concurrency: 5 }
  );
}
