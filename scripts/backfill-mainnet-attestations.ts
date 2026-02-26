/**
 * Backfills mainnet HCS attestations for all tweets already in the database.
 * Uses only DB data — no SocialData API calls.
 *
 * Run AFTER:
 *   1. Setting HEDERA_NETWORK=mainnet, HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY,
 *      HEDERA_TOPIC_ID in .env (mainnet values)
 *   2. Creating the mainnet topic via scripts/create-hcs-topic.ts
 *
 * Usage: npx tsx --env-file=.env scripts/backfill-mainnet-attestations.ts
 */

import {
  Client,
  TopicMessageSubmitTransaction,
  AccountId,
  PrivateKey,
} from "@hashgraph/sdk";
import { getDb, tweets, trackedAccounts, hcsAttestations } from "@taa/db";
import { eq } from "drizzle-orm";

const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = process.env.HEDERA_OPERATOR_KEY;
const network = process.env.HEDERA_NETWORK ?? "testnet";
const topicId = process.env.HEDERA_TOPIC_ID;

if (!operatorId || !operatorKey || !topicId) {
  console.error("HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY, and HEDERA_TOPIC_ID are required");
  process.exit(1);
}

if (network !== "mainnet") {
  console.error(`HEDERA_NETWORK is "${network}" — set it to "mainnet" before running this script`);
  process.exit(1);
}

function getClient(): Client {
  const client = Client.forMainnet();
  client.setOperator(
    AccountId.fromString(operatorId!),
    PrivateKey.fromString(operatorKey!)
  );
  return client;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const db = getDb();

  // 1. Count existing testnet attestations
  const allAttestations = await db.select({ id: hcsAttestations.id }).from(hcsAttestations);
  console.log(`Found ${allAttestations.length} existing attestation records (testnet).`);

  if (allAttestations.length > 0) {
    console.log("Clearing testnet attestations...");
    await db.delete(hcsAttestations);
    console.log("  Cleared.\n");
  }

  // 2. Fetch all tweets with account username
  const tweetRows = await db
    .select({
      id: tweets.id,
      tweetId: tweets.tweetId,
      authorId: tweets.authorId,
      contentHash: tweets.contentHash,
      postedAt: tweets.postedAt,
      username: trackedAccounts.username,
    })
    .from(tweets)
    .leftJoin(trackedAccounts, eq(tweets.accountId, trackedAccounts.id))
    .orderBy(tweets.postedAt);

  console.log(`Attesting ${tweetRows.length} tweets to mainnet topic ${topicId}...\n`);

  let success = 0;
  let failed = 0;

  for (const tweet of tweetRows) {
    const client = getClient();
    try {
      const payload = {
        type: "tweet_attestation",
        tweetId: tweet.tweetId,
        authorId: tweet.authorId,
        username: tweet.username ?? "unknown",
        postedAt: tweet.postedAt.toISOString(),
        contentHash: tweet.contentHash,
        topicId,
        submittedAt: new Date().toISOString(),
      };

      const tx = await new TopicMessageSubmitTransaction()
        .setTopicId(topicId!)
        .setMessage(JSON.stringify(payload))
        .execute(client);

      const receipt = await tx.getReceipt(client);
      const record = await tx.getRecord(client);

      const sequenceNumber = receipt.topicSequenceNumber?.toNumber() ?? 0;
      const consensusTimestamp = record.consensusTimestamp?.toDate() ?? new Date();
      const transactionId = tx.transactionId?.toString() ?? "";

      await db.insert(hcsAttestations).values({
        tweetId: tweet.id,
        topicId: topicId!,
        sequenceNumber,
        transactionId,
        contentHash: tweet.contentHash,
        consensusTimestamp,
        messagePayload: payload,
      });

      success++;
      console.log(`  [${success}/${tweetRows.length}] @${tweet.username} tweet ${tweet.tweetId} — seq=${sequenceNumber}`);

      // ~2 tx/sec to stay well within HCS rate limits
      await sleep(500);
    } catch (err) {
      failed++;
      console.error(`  [fail] tweet ${tweet.tweetId}:`, err);
      // Continue — don't abort the whole backfill on one failure
      await sleep(1000);
    } finally {
      client.close();
    }
  }

  console.log(`\nDone: ${success} attested, ${failed} failed`);
  if (failed > 0) {
    console.log("Re-run the script to retry failed tweets — already-attested tweets will be skipped by the unique index.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
