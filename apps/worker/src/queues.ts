import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { QUEUE_NAMES } from "@taa/shared";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const ingestionPriorityQueue = new Queue(QUEUE_NAMES.INGESTION_PRIORITY, { connection });
export const ingestionStandardQueue = new Queue(QUEUE_NAMES.INGESTION_STANDARD, { connection });
export const ingestionLowQueue = new Queue(QUEUE_NAMES.INGESTION_LOW, { connection });
export const deletionCheckQueue = new Queue(QUEUE_NAMES.DELETION_CHECK, { connection });
export const hcsSubmitQueue = new Queue(QUEUE_NAMES.HCS_SUBMIT, { connection });
export const mediaArchiveQueue = new Queue(QUEUE_NAMES.MEDIA_ARCHIVE, { connection });
