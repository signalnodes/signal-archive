import { Worker, Job } from "bullmq";
import { eq } from "drizzle-orm";
import { connection, hcsSubmitQueue, mediaArchiveQueue } from "../queues";
import {
  QUEUE_NAMES,
  computeContentHash,
  type CanonicalTweet,
  type TrackingTier,
} from "@taa/shared";
import { getDb, tweets } from "@taa/db";
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
  const { accountId, username, twitterId, tier } = job.data;
  console.log(`[ingest] Processing @${username} (tier: ${tier})`);

  const scraped = await provider.fetchTweets(username, twitterId);
  const db = getDb();
  let newCount = 0;
  let dupeCount = 0;
  let skippedCount = 0;

  for (const tweet of scraped) {
    // Skip tweets before the archive cutoff date
    if (tweet.postedAt < ARCHIVE_SINCE) {
      skippedCount++;
      continue;
    }

    // Dedup: check if tweet already exists
    const existing = await db.query.tweets.findFirst({
      where: eq(tweets.tweetId, tweet.tweetId),
      columns: { id: true },
    });

    if (existing) {
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

    // Insert into DB
    const [inserted] = await db
      .insert(tweets)
      .values({
        tweetId: tweet.tweetId,
        accountId,
        authorId: tweet.authorId,
        content: tweet.content,
        rawJson: tweet,
        tweetType: tweet.tweetType,
        mediaUrls: tweet.mediaUrls,
        engagement: tweet.engagement,
        postedAt: tweet.postedAt,
        contentHash,
      })
      .returning({ id: tweets.id });

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

export function createIngestionWorkers(provider: TweetProvider) {
  const tiers: Array<{ queue: string; concurrency: number }> = [
    { queue: QUEUE_NAMES.INGESTION_PRIORITY, concurrency: 3 },
    { queue: QUEUE_NAMES.INGESTION_STANDARD, concurrency: 5 },
    { queue: QUEUE_NAMES.INGESTION_LOW, concurrency: 2 },
  ];

  return tiers.map(
    ({ queue, concurrency }) =>
      new Worker(
        queue,
        (job: Job<IngestJobData>) => processIngestion(job, provider),
        { connection, concurrency }
      )
  );
}
