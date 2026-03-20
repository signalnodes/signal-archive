/**
 * Check BullMQ failed (dead-letter) jobs across all queues.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/check-failed-jobs.ts
 *   npx tsx --env-file=.env scripts/check-failed-jobs.ts --retry   # retry all failed
 *   npx tsx --env-file=.env scripts/check-failed-jobs.ts --clean   # remove all failed
 */

import { Queue } from "bullmq";
import { Redis } from "ioredis";

const RETRY = process.argv.includes("--retry");
const CLEAN = process.argv.includes("--clean");

const rawUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const url = new URL(rawUrl);

const connection = new Redis({
  host: url.hostname,
  port: Number(url.port) || 6379,
  password: url.password || undefined,
  ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  maxRetriesPerRequest: null,
});

const QUEUE_NAMES = ["ingestion", "deletion-check", "hcs-submit", "media-archive"];

async function main() {
  let totalFailed = 0;

  for (const name of QUEUE_NAMES) {
    const queue = new Queue(name, { connection });
    const failed = await queue.getFailed(0, 100);

    if (failed.length === 0) {
      console.log(`[${name}] 0 failed jobs`);
    } else {
      console.log(`\n[${name}] ${failed.length} failed job(s):`);
      for (const job of failed) {
        const age = job.finishedOn
          ? `${Math.round((Date.now() - job.finishedOn) / 3_600_000)}h ago`
          : "unknown age";
        console.log(`  id=${job.id} name=${job.name} attempts=${job.attemptsMade} failed=${age}`);
        if (job.failedReason) console.log(`    reason: ${job.failedReason.slice(0, 120)}`);

        if (RETRY) {
          await job.retry();
          console.log(`    → retried`);
        } else if (CLEAN) {
          await job.remove();
          console.log(`    → removed`);
        }
      }
      totalFailed += failed.length;
    }

    await queue.close();
  }

  console.log(`\nTotal failed: ${totalFailed}`);
  if (totalFailed > 0 && !RETRY && !CLEAN) {
    console.log("Run with --retry to requeue all, or --clean to discard.");
  }

  await connection.quit();
}

main().catch((e) => { console.error(e); process.exit(1); });
