import { createIngestionWorkers } from "./jobs/ingest";
import { createDeletionCheckWorker } from "./jobs/check-deletions";
import { createHcsSubmitWorker } from "./jobs/submit-hcs";
import { createMediaArchiveWorker } from "./jobs/archive-media";

console.log("[worker] Starting TAA workers...");

const workers = [
  ...createIngestionWorkers(),
  createDeletionCheckWorker(),
  createHcsSubmitWorker(),
  createMediaArchiveWorker(),
];

console.log(`[worker] ${workers.length} workers registered`);

async function shutdown() {
  console.log("[worker] Shutting down gracefully...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
