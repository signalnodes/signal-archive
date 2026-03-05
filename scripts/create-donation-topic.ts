/**
 * Creates the HCS topic for donation receipts on Hedera.
 *
 * This topic is separate from the tweet attestation topic and the research topic.
 * It stores one message per donation, submitted by the server as part of the
 * atomic batch transaction (HIP-551).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/create-donation-topic.ts
 *   HEDERA_NETWORK=mainnet npx tsx --env-file=.env scripts/create-donation-topic.ts
 */

import {
  Client,
  AccountId,
  PrivateKey,
  TopicCreateTransaction,
} from "@hashgraph/sdk";

const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY;
const NETWORK = process.env.HEDERA_NETWORK ?? "testnet";

if (!OPERATOR_ID || !OPERATOR_KEY) {
  console.error("Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY");
  process.exit(1);
}

async function main() {
  console.log(`Creating donation receipt HCS topic on ${NETWORK}...\n`);

  const client =
    NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  const operatorKey = PrivateKey.fromStringED25519(OPERATOR_KEY!);
  client.setOperator(AccountId.fromString(OPERATOR_ID!), operatorKey);

  const tx = await new TopicCreateTransaction()
    .setTopicMemo("Signal Archive — donation receipts")
    .setSubmitKey(operatorKey.publicKey)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const topicId = receipt.topicId?.toString();

  console.log(`Donation receipt topic created: ${topicId}`);
  console.log(`\nAdd to Railway web env vars:`);
  console.log(`  HEDERA_DONATION_TOPIC_ID=${topicId}`);

  client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
