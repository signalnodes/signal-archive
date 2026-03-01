import { eq } from "drizzle-orm";
import { getDb, trackedAccounts } from "@taa/db";
import {
  TIER_INTERVALS,
  TIER_PRIORITIES,
  QUEUE_NAMES,
  applyJitter,
  type TrackingTier,
} from "@taa/shared";
import { ingestionQueue, deletionCheckQueue } from "./queues";
import type { IngestJobData } from "./jobs/ingest";
import type { CheckDeletionsJobData } from "./jobs/check-deletions";

export async function registerScheduledJobs() {
  const db = getDb();

  // Clear stale repeatable jobs from previous intervals before re-registering
  const allQueues = [ingestionQueue, deletionCheckQueue];
  for (const queue of allQueues) {
    const repeatable = await queue.getRepeatableJobs();
    for (const job of repeatable) {
      await queue.removeRepeatableByKey(job.key);
    }
  }
  console.log("[scheduler] Cleared old repeatable jobs");

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

    await ingestionQueue.add(jobId, jobData, {
      repeat: { every: interval },
      jobId,
      priority: TIER_PRIORITIES[tier],
    });

    console.log(
      `[scheduler] ${account.username} → ingestion (${tier}, every ${Math.round(interval / 1000)}s)`
    );
  }

  // Register deletion-check repeatable job (every 15 minutes)
  const deletionJobId = "deletion-check:main";
  const deletionJobData: CheckDeletionsJobData = { cycleCount: 0 };

  await deletionCheckQueue.add(deletionJobId, deletionJobData, {
    repeat: { every: 15 * 60 * 1000 },
    jobId: deletionJobId,
  });

  console.log("[scheduler] Deletion check registered (every 15 min)");
  console.log("[scheduler] All repeatable jobs registered");
}
