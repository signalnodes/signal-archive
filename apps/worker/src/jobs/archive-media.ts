import { Worker, Job } from "bullmq";
import { connection } from "../queues";
import { QUEUE_NAMES } from "@taa/shared";

export interface ArchiveMediaJobData {
  tweetId: string;
  mediaUrls: string[];
}

async function processMediaArchive(job: Job<ArchiveMediaJobData>) {
  const { tweetId, mediaUrls } = job.data;
  console.warn(`[archive-media] Not yet implemented — skipping ${mediaUrls.length} media files for tweet ${tweetId}`);
  // TODO: implement media download + storage (Cloudflare R2 / S3)
  // For now, log and return so the job completes without losing track of what was queued.
}

export function createMediaArchiveWorker() {
  return new Worker(QUEUE_NAMES.MEDIA_ARCHIVE, processMediaArchive, {
    connection,
    concurrency: 3,
  });
}
