import { Worker, Job } from "bullmq";
import { eq, and, lte, gt, sql } from "drizzle-orm";
import { connection, hcsSubmitQueue } from "../queues";
import { QUEUE_NAMES, DELETION_CHECK_THRESHOLDS } from "@taa/shared";
import { getDb, tweets, deletionEvents, trackedAccounts } from "@taa/db";
import type { DeletionChecker } from "../services/deletion-checker";
import { detectMassDeletion } from "./detect-mass-deletions";

const MAX_BATCH_SIZE = 25;

export interface CheckDeletionsJobData {
  cycleCount: number;
}

async function processDeletionCheck(
  job: Job<CheckDeletionsJobData>,
  checker: DeletionChecker
) {
  const cycleCount = job.data.cycleCount ?? 0;
  const db = getDb();
  const now = new Date();
  const {
    RECENT_DAYS,
    MEDIUM_DAYS,
    MEDIUM_CYCLE_DIVISOR,
    OLD_DAYS,
    OLD_CYCLE_DIVISOR,
    ARCHIVE_CYCLE_DIVISOR,
  } = DELETION_CHECK_THRESHOLDS;

  const recentCutoff = new Date(now.getTime() - RECENT_DAYS * 86_400_000);
  const mediumCutoff = new Date(now.getTime() - MEDIUM_DAYS * 86_400_000);
  const oldCutoff = new Date(now.getTime() - OLD_DAYS * 86_400_000);

  // Build age bracket conditions based on cycle count
  const conditions: ReturnType<typeof and>[] = [];

  // Recent (<7d): every cycle
  conditions.push(
    and(eq(tweets.isDeleted, false), gt(tweets.postedAt, recentCutoff))
  );

  // Medium (7-30d): every 4th cycle
  if (cycleCount % MEDIUM_CYCLE_DIVISOR === 0) {
    conditions.push(
      and(
        eq(tweets.isDeleted, false),
        lte(tweets.postedAt, recentCutoff),
        gt(tweets.postedAt, mediumCutoff)
      )
    );
  }

  // Old (30-90d): every 12th cycle
  if (cycleCount % OLD_CYCLE_DIVISOR === 0) {
    conditions.push(
      and(
        eq(tweets.isDeleted, false),
        lte(tweets.postedAt, mediumCutoff),
        gt(tweets.postedAt, oldCutoff)
      )
    );
  }

  // Archive (>90d): skip if divisor is 0 (disabled), otherwise every Nth cycle
  if (ARCHIVE_CYCLE_DIVISOR > 0 && cycleCount % ARCHIVE_CYCLE_DIVISOR === 0) {
    conditions.push(
      and(eq(tweets.isDeleted, false), lte(tweets.postedAt, oldCutoff))
    );
  }

  // Query tweets matching any age bracket, oldest first, limited to batch size
  const tweetsToCheck = await db
    .select({
      id: tweets.id,
      tweetId: tweets.tweetId,
      accountId: tweets.accountId,
      content: tweets.content,
      postedAt: tweets.postedAt,
      contentHash: tweets.contentHash,
      authorId: tweets.authorId,
      username: trackedAccounts.username,
    })
    .from(tweets)
    .leftJoin(trackedAccounts, eq(tweets.accountId, trackedAccounts.id))
    .where(sql`(${sql.join(conditions, sql` OR `)})`)
    .orderBy(tweets.postedAt)
    .limit(MAX_BATCH_SIZE);

  if (tweetsToCheck.length === 0) {
    console.log(
      `[deletion-check] Cycle ${cycleCount}: no tweets to check`
    );
    await job.updateData({ cycleCount: cycleCount + 1 });
    return;
  }

  const tweetIds = tweetsToCheck.map((t) => t.tweetId);
  const statusMap = await checker.checkTweets(tweetIds);

  let deletionCount = 0;
  const affectedAccountIds = new Set<string>();

  for (const tweet of tweetsToCheck) {
    const stillExists = statusMap.get(tweet.tweetId);
    if (stillExists !== false) continue;

    // Tweet was deleted
    deletionCount++;
    if (tweet.accountId) affectedAccountIds.add(tweet.accountId);
    const detectedAt = new Date();
    const tweetAgeHours = Math.round(
      (detectedAt.getTime() - tweet.postedAt.getTime()) / 3_600_000
    );
    const contentPreview = tweet.content.slice(0, 280);

    await db
      .update(tweets)
      .set({
        isDeleted: true,
        deletedAt: detectedAt,
        deletionDetectedAt: detectedAt,
        updatedAt: detectedAt,
      })
      .where(eq(tweets.id, tweet.id));

    await db.insert(deletionEvents).values({
      tweetId: tweet.id,
      accountId: tweet.accountId,
      detectedAt,
      tweetAgeHours: String(tweetAgeHours),
      contentPreview,
    });

    await hcsSubmitQueue.add(`hcs:deletion:${tweet.tweetId}`, {
      dbId: tweet.id,
      tweetId: tweet.tweetId,
      authorId: tweet.authorId,
      contentHash: tweet.contentHash,
      type: "deletion_detected" as const,
      username: tweet.username ?? "unknown",
      postedAt: tweet.postedAt.toISOString(),
    });
  }

  console.log(
    `[deletion-check] Cycle ${cycleCount}: checked ${tweetsToCheck.length} tweets, ${deletionCount} deletions detected`
  );

  // Check for mass deletion events on any account that had new deletions
  if (affectedAccountIds.size > 0) {
    await Promise.all(
      [...affectedAccountIds].map((accountId) => detectMassDeletion(db, accountId))
    );
  }

  await job.updateData({ cycleCount: cycleCount + 1 });
}

export function createDeletionCheckWorker(checker: DeletionChecker) {
  return new Worker(
    QUEUE_NAMES.DELETION_CHECK,
    (job: Job<CheckDeletionsJobData>) => processDeletionCheck(job, checker),
    { connection, concurrency: 1 }
  );
}
