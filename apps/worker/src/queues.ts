import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { QUEUE_NAMES } from "@taa/shared";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

function parseRedisConnection(url: string) {
  const parsed = new URL(url);
  const isTls = parsed.protocol === "rediss:";
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port) : 6379,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    tls: isTls ? {} : undefined,
    maxRetriesPerRequest: null as null,
  };
}

export const connection = new Redis(parseRedisConnection(redisUrl));

export const ingestionQueue = new Queue(QUEUE_NAMES.INGESTION, { connection });
export const deletionCheckQueue = new Queue(QUEUE_NAMES.DELETION_CHECK, { connection });
export const hcsSubmitQueue = new Queue(QUEUE_NAMES.HCS_SUBMIT, { connection });
export const mediaArchiveQueue = new Queue(QUEUE_NAMES.MEDIA_ARCHIVE, { connection });
