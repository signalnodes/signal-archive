import { createIngestionWorkers } from "./jobs/ingest";
import { createDeletionCheckWorker } from "./jobs/check-deletions";
import { createHcsSubmitWorker } from "./jobs/submit-hcs";
import { createMediaArchiveWorker } from "./jobs/archive-media";
import { createProvider } from "./services/scraper";
import { createDeletionChecker } from "./services/deletion-checker";
import { registerScheduledJobs } from "./scheduler";

console.log("[worker] Starting TAA workers...");

const provider = createProvider();
const checker = createDeletionChecker();

const workers = [
  ...createIngestionWorkers(provider),
  createDeletionCheckWorker(checker),
  createHcsSubmitWorker(),
  createMediaArchiveWorker(),
];

console.log(`[worker] ${workers.length} workers registered`);

registerScheduledJobs()
  .then(() => console.log("[worker] Scheduler ready"))
  .catch((err) => {
    console.error("[worker] Scheduler failed, shutting down:", err);
    process.exit(1);
  });

async function shutdown() {
  console.log("[worker] Shutting down gracefully...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
