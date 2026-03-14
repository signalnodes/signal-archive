import { createIngestionWorker } from "./jobs/ingest";
import { createDeletionCheckWorker } from "./jobs/check-deletions";
import { createHcsSubmitWorker } from "./jobs/submit-hcs";
import { createMediaArchiveWorker } from "./jobs/archive-media";
import { createProvider } from "./services/scraper";
import { createDeletionChecker } from "./services/deletion-checker";
import { registerScheduledJobs } from "./scheduler";
import { startHeartbeat, stopHeartbeat } from "./heartbeat";
import { workerEnvSchema } from "@taa/shared";

console.log("[worker] Starting TAA workers...");

const envResult = workerEnvSchema.safeParse(process.env);
if (!envResult.success) {
  console.error("[worker] Missing required env vars:", envResult.error.flatten().fieldErrors);
  process.exit(1);
}

const provider = createProvider();
const checker = createDeletionChecker();

const workers = [
  createIngestionWorker(provider),
  createDeletionCheckWorker(checker),
  createHcsSubmitWorker(),
  createMediaArchiveWorker(),
];

console.log(`[worker] ${workers.length} workers registered`);

for (const worker of workers) {
  worker.on("failed", (job, err) => {
    console.error(`[worker] job failed — queue=${worker.name} id=${job?.id} err=${err?.message}`);
  });
}

registerScheduledJobs()
  .then(() => {
    console.log("[worker] Scheduler ready");
    startHeartbeat();
  })
  .catch((err) => {
    console.error("[worker] Scheduler failed, shutting down:", err);
    process.exit(1);
  });

async function shutdown() {
  console.log("[worker] Shutting down gracefully...");
  stopHeartbeat();
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
