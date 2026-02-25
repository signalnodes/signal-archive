import { Worker, Job } from "bullmq";
import { connection } from "../queues";
import { QUEUE_NAMES } from "@taa/shared";

export interface IngestJobData {
  accountId: string;
  username: string;
  tier: string;
}

async function processIngestion(job: Job<IngestJobData>) {
  const { accountId, username, tier } = job.data;
  console.log(`[ingest] Processing ${username} (tier: ${tier})`);
  // TODO: implement browser-based ingestion via Stagehand
}

export function createIngestionWorkers() {
  const tiers = [
    QUEUE_NAMES.INGESTION_PRIORITY,
    QUEUE_NAMES.INGESTION_STANDARD,
    QUEUE_NAMES.INGESTION_LOW,
  ];

  return tiers.map(
    (queueName) =>
      new Worker(queueName, processIngestion, { connection })
  );
}
