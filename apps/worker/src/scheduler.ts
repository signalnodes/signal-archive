import { eq } from "drizzle-orm";
import { getDb, trackedAccounts } from "@taa/db";
import {
  TIER_INTERVALS,
  QUEUE_NAMES,
  applyJitter,
  type TrackingTier,
} from "@taa/shared";
import {
  ingestionPriorityQueue,
  ingestionStandardQueue,
  ingestionLowQueue,
  deletionCheckQueue,
} from "./queues";
import type { IngestJobData } from "./jobs/ingest";
import type { CheckDeletionsJobData } from "./jobs/check-deletions";

const TIER_QUEUES = {
  priority: ingestionPriorityQueue,
  standard: ingestionStandardQueue,
  low: ingestionLowQueue,
} as const;

const TIER_QUEUE_NAMES: Record<TrackingTier, string> = {
  priority: QUEUE_NAMES.INGESTION_PRIORITY,
  standard: QUEUE_NAMES.INGESTION_STANDARD,
  low: QUEUE_NAMES.INGESTION_LOW,
};

export async function registerScheduledJobs() {
  const db = getDb();

  const accounts = await db.query.trackedAccounts.findMany({
    where: eq(trackedAccounts.isActive, true),
  });

  if (accounts.length === 0) {
    console.log("[scheduler] No active accounts found, skipping registration");
    return;
  }

  console.log(
    `[scheduler] Registering repeatable jobs for ${accounts.length} active accounts`
  );

  for (const account of accounts) {
    const tier = account.trackingTier as TrackingTier;
    const queue = TIER_QUEUES[tier];
    const baseInterval = TIER_INTERVALS[tier];
    const interval = applyJitter(baseInterval);

    // Stable jobId prevents duplicate registration on restart
    const jobId = `ingest:${account.username}`;

    const jobData: IngestJobData = {
      accountId: account.id,
      username: account.username,
      twitterId: account.twitterId,
      tier,
    };

    await queue.add(jobId, jobData, {
      repeat: {
        every: interval,
      },
      jobId,
    });

    console.log(
      `[scheduler] ${account.username} → ${TIER_QUEUE_NAMES[tier]} (every ${Math.round(interval / 1000)}s)`
    );
  }

  // Register deletion-check repeatable job (every 5 minutes)
  const deletionJobId = "deletion-check:main";
  const deletionJobData: CheckDeletionsJobData = { cycleCount: 0 };

  await deletionCheckQueue.add(deletionJobId, deletionJobData, {
    repeat: { every: 5 * 60 * 1000 },
    jobId: deletionJobId,
  });

  console.log("[scheduler] Deletion check registered (every 5 min)");
  console.log("[scheduler] All repeatable jobs registered");
}
