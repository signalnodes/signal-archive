import { Worker, Job } from "bullmq";
import { connection } from "../queues";
import { QUEUE_NAMES } from "@taa/shared";

export interface CheckDeletionsJobData {
  batchId?: string;
}

async function processDeletionCheck(job: Job<CheckDeletionsJobData>) {
  console.log(`[check-deletions] Running batch check`);
  // TODO: implement deletion checking via third-party API + browser fallback
}

export function createDeletionCheckWorker() {
  return new Worker(QUEUE_NAMES.DELETION_CHECK, processDeletionCheck, {
    connection,
  });
}
