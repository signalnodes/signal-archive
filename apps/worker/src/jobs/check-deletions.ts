import { Worker, Job } from "bullmq";
import { eq, and, lte, gt, sql } from "drizzle-orm";
import { connection, hcsSubmitQueue } from "../queues";
import { QUEUE_NAMES, DELETION_CHECK_THRESHOLDS, DELETION_CHECK_BATCH_SIZE } from "@taa/shared";
import type { ScoringContext } from "@taa/shared";
import { getDb, tweets, deletionEvents, trackedAccounts } from "@taa/db";
import type { DeletionChecker } from "../services/deletion-checker";
import { detectMassDeletion } from "./detect-mass-deletions";
import { scoreDeletion } from "../services/ai-scorer";

const WORKER_LAST_SEEN_KEY = "worker:last-seen";
const WORKER_LAST_SEEN_TTL = 1800; // 30 min — expires if worker dies
const CYCLE_COUNT_KEY = "worker:deletion-cycle-count";


export interface CheckDeletionsJobData {
  cycleCount: number;
}

async function processDeletionCheck(
  job: Job<CheckDeletionsJobData>,
  checker: DeletionChecker
) {
  const raw = await connection.get(CYCLE_COUNT_KEY);
  const cycleCount = raw !== null ? parseInt(raw, 10) : 0;
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
  // Include account context for AI severity scoring
  const tweetsToCheck = await db
    .select({
      id: tweets.id,
      tweetId: tweets.tweetId,
      accountId: tweets.accountId,
      content: tweets.content,
      tweetType: tweets.tweetType,
      mediaUrls: tweets.mediaUrls,
      postedAt: tweets.postedAt,
      contentHash: tweets.contentHash,
      authorId: tweets.authorId,
      username: trackedAccounts.username,
      displayName: trackedAccounts.displayName,
      category: trackedAccounts.category,
      subcategory: trackedAccounts.subcategory,
    })
    .from(tweets)
    .leftJoin(trackedAccounts, eq(tweets.accountId, trackedAccounts.id))
    .where(sql`(${sql.join(conditions, sql` OR `)})`)
    .orderBy(tweets.postedAt)
    .limit(DELETION_CHECK_BATCH_SIZE);

  if (tweetsToCheck.length === 0) {
    console.log(
      `[deletion-check] Cycle ${cycleCount}: no tweets to check`
    );
    await connection.set(CYCLE_COUNT_KEY, String(cycleCount + 1));
    return;
  }

  const tweetRefs = tweetsToCheck.map((t) => ({
    tweetId: t.tweetId,
    username: t.username ?? "unknown",
  }));
  const statusMap = await checker.checkTweets(tweetRefs);

  // Sanity guard: if >50% of batch shows as deleted, something is wrong with the
  // checker (e.g. oEmbed URL format broken, rate-limited, network issue). Abort
  // the cycle rather than recording hundreds of false positive deletions on HCS.
  const rawDeletedCount = [...statusMap.values()].filter((v) => !v).length;
  if (rawDeletedCount > tweetsToCheck.length * 0.5) {
    console.error(
      `[deletion-check] Cycle ${cycleCount}: SANITY CHECK FAILED — ` +
      `${rawDeletedCount}/${tweetsToCheck.length} tweets flagged as deleted (>50%). ` +
      `Aborting cycle to avoid false positive HCS attestations. Check oEmbed connectivity.`
    );
    await connection.set(CYCLE_COUNT_KEY, String(cycleCount + 1));
    return;
  }

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

    // --- AI severity scoring ---
    const scoringCtx: ScoringContext = {
      username: tweet.username ?? "unknown",
      displayName: tweet.displayName ?? null,
      category: tweet.category ?? "unknown",
      subcategory: tweet.subcategory ?? null,
      content: tweet.content,
      postedAt: tweet.postedAt.toISOString(),
      tweetAgeHours,
      tweetType: tweet.tweetType ?? "tweet",
      hasMedia: (tweet.mediaUrls?.length ?? 0) > 0,
    };

    const scoring = await scoreDeletion(scoringCtx);

    console.log(
      `[deletion-check] Scored @${scoringCtx.username} deletion: ${scoring.severity}/10 (${scoring.model}, ${scoring.latencyMs}ms)`
    );

    await db
      .update(tweets)
      .set({
        isDeleted: true,
        deletedAt: detectedAt,
        deletionDetectedAt: detectedAt,
        updatedAt: detectedAt,
      })
      .where(eq(tweets.id, tweet.id));

    if (!tweet.accountId) {
      console.warn(`[deletion-check] Tweet ${tweet.tweetId} has no accountId, skipping deletion event`);
    } else {
      await db.insert(deletionEvents).values({
        tweetId: tweet.id,
        accountId: tweet.accountId,
        detectedAt,
        tweetAgeHours: String(tweetAgeHours),
        contentPreview,
        severityScore: scoring.severity,
        categoryTags: scoring.categoryTags,
        metadata: {
          ai: {
            reasoning: scoring.reasoning,
            confidence: scoring.confidence,
            model: scoring.model,
            scoredAt: scoring.scoredAt,
            latencyMs: scoring.latencyMs,
          },
        },
      }).onConflictDoNothing();
    }

    await hcsSubmitQueue.add(`hcs:deletion:${tweet.tweetId}`, {
      dbId: tweet.id,
      tweetId: tweet.tweetId,
      authorId: tweet.authorId,
      contentHash: tweet.contentHash,
      type: "deletion_detected" as const,
      username: tweet.username ?? "unknown",
      postedAt: tweet.postedAt.toISOString(),
      severity: scoring.severity,
      severityModel: scoring.model,
      severityConfidence: scoring.confidence,
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

  // Record liveness; health endpoint reads this to detect a silent worker
  await connection.set(WORKER_LAST_SEEN_KEY, Date.now().toString(), "EX", WORKER_LAST_SEEN_TTL);

  await connection.set(CYCLE_COUNT_KEY, String(cycleCount + 1));
}

export function createDeletionCheckWorker(checker: DeletionChecker) {
  return new Worker(
    QUEUE_NAMES.DELETION_CHECK,
    (job: Job<CheckDeletionsJobData>) => processDeletionCheck(job, checker),
    { connection, concurrency: 1 }
  );
}
