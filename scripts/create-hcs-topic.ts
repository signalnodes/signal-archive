/**
 * Creates a new HCS topic on the configured Hedera network.
 * Usage: npx tsx --env-file=.env scripts/create-hcs-topic.ts
 *
 * Set HEDERA_NETWORK=mainnet in .env before running for mainnet.
 */

import {
  Client,
  TopicCreateTransaction,
  AccountId,
  PrivateKey,
} from "@hashgraph/sdk";

const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = process.env.HEDERA_OPERATOR_KEY;
const network = process.env.HEDERA_NETWORK ?? "testnet";

if (!operatorId || !operatorKey) {
  console.error("HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY are required");
  process.exit(1);
}

async function main() {
  console.log(`Creating HCS topic on ${network}...\n`);

  const client =
    network === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId!),
    PrivateKey.fromString(operatorKey!)
  );

  const tx = await new TopicCreateTransaction()
    .setTopicMemo("Signal Archive — tweet attestations")
    .setSubmitKey(PrivateKey.fromString(operatorKey!).publicKey)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const topicId = receipt.topicId?.toString();

  console.log(`Topic created: ${topicId}`);
  console.log(`\nAdd to Railway worker env vars:`);
  console.log(`  HEDERA_NETWORK=${network}`);
  console.log(`  HEDERA_TOPIC_ID=${topicId}`);

  client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
