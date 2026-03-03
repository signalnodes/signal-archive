/**
 * Creates the Signal Archive Research HCS topic on Hedera mainnet.
 * Used for attesting donor-only investigative data:
 *   - account_flagged: Twitter account IDs added to research monitoring
 *   - wallet_flagged:  Crypto wallets flagged for sketchy activity
 *
 * Usage: npx tsx --env-file=.env scripts/create-research-topic.ts
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
  console.log(`Creating Research HCS topic on ${network}...\n`);

  const client =
    network === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId!),
    PrivateKey.fromStringED25519(operatorKey!)
  );

  const tx = await new TopicCreateTransaction()
    .setTopicMemo("Signal Archive — research: wallet & account flagging")
    .setSubmitKey(PrivateKey.fromStringED25519(operatorKey!).publicKey)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const topicId = receipt.topicId?.toString();

  console.log(`Research topic created: ${topicId}`);
  console.log(`\nAdd to Railway env vars (both web and worker):`);
  console.log(`  HEDERA_RESEARCH_TOPIC_ID=${topicId}`);
  console.log(`\nAlso add to .env.example and .env`);

  client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
