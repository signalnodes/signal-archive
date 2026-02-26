import { Worker, Job } from "bullmq";
import {
  Client,
  TopicMessageSubmitTransaction,
  AccountId,
  PrivateKey,
} from "@hashgraph/sdk";
import { eq } from "drizzle-orm";
import { connection } from "../queues";
import { QUEUE_NAMES } from "@taa/shared";
import { getDb, hcsAttestations } from "@taa/db";

export interface SubmitHcsJobData {
  dbId: string;
  tweetId: string;
  authorId: string; // numeric Twitter user ID
  contentHash: string;
  type: "tweet_attestation" | "deletion_detected";
  username: string;
  postedAt: string; // ISO string
}

function getHederaClient(): Client {
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;
  const network = process.env.HEDERA_NETWORK ?? "testnet";

  if (!operatorId || !operatorKey) {
    throw new Error("HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set");
  }

  const client =
    network === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromStringED25519(operatorKey));
  return client;
}

function getTopicId(): string {
  const topicId = process.env.HEDERA_TOPIC_ID;
  if (!topicId) throw new Error("HEDERA_TOPIC_ID must be set");
  return topicId;
}

async function processHcsSubmission(job: Job<SubmitHcsJobData>) {
  const { dbId, tweetId, authorId, contentHash, type, username, postedAt } = job.data;
  const db = getDb();

  // Skip if already attested (idempotency guard)
  const existing = await db
    .select({ id: hcsAttestations.id })
    .from(hcsAttestations)
    .where(eq(hcsAttestations.tweetId, dbId))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[submit-hcs] Already attested tweet ${tweetId}, skipping`);
    return;
  }

  const topicId = getTopicId();
  const client = getHederaClient();

  const payload = {
    type,
    tweetId,
    authorId,
    username,
    postedAt,
    contentHash,
    topicId,
    submittedAt: new Date().toISOString(),
  };

  try {
    console.log(`[submit-hcs] Submitting ${type} for tweet ${tweetId}`);

    const tx = await new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(JSON.stringify(payload))
      .execute(client);

    const receipt = await tx.getReceipt(client);
    const record = await tx.getRecord(client);

    const sequenceNumber = receipt.topicSequenceNumber?.toNumber() ?? 0;
    const consensusTimestamp = record.consensusTimestamp?.toDate() ?? new Date();
    // Format: shard.realm.num@seconds.nanos
    const transactionId = tx.transactionId?.toString() ?? "";

    await db.insert(hcsAttestations).values({
      tweetId: dbId,
      topicId,
      sequenceNumber,
      transactionId,
      contentHash,
      consensusTimestamp,
      messagePayload: payload,
    });

    console.log(
      `[submit-hcs] Attested tweet ${tweetId} — seq=${sequenceNumber} tx=${transactionId}`
    );
  } finally {
    client.close();
  }
}

export function createHcsSubmitWorker() {
  return new Worker(QUEUE_NAMES.HCS_SUBMIT, processHcsSubmission, {
    connection,
    concurrency: 1, // Sequential — avoid HCS rate limits
  });
}
