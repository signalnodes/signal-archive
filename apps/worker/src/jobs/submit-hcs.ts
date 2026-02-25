import { Worker, Job } from "bullmq";
import { connection } from "../queues";
import { QUEUE_NAMES } from "@taa/shared";

export interface SubmitHcsJobData {
  tweetId: string;
  contentHash: string;
  type: "tweet_attestation" | "deletion_detected";
}

async function processHcsSubmission(job: Job<SubmitHcsJobData>) {
  const { tweetId, contentHash, type } = job.data;
  console.log(`[submit-hcs] Submitting ${type} for tweet ${tweetId}`);
  // TODO: implement HCS message submission via @hashgraph/sdk
}

export function createHcsSubmitWorker() {
  return new Worker(QUEUE_NAMES.HCS_SUBMIT, processHcsSubmission, {
    connection,
    concurrency: 1, // Sequential HCS submissions
  });
}
