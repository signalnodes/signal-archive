/**
 * Creates an HCS-2 topic registry for Signal Archive on Hedera mainnet.
 *
 * This script:
 *   1. Creates a new HCS topic that serves as the HCS-2 registry
 *   2. Registers the main attestation topic (0.0.10301350) into that registry
 *
 * Run once on mainnet, then hardcode the resulting registry topic ID into
 * the /registry page and About page.
 *
 * Usage: npx tsx --env-file=.env scripts/create-hcs2-registry.ts
 */

import {
  Client,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
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

if (network !== "mainnet") {
  console.warn(`WARNING: HEDERA_NETWORK is set to "${network}". Set HEDERA_NETWORK=mainnet to run on mainnet.`);
}

async function main() {
  console.log(`Creating HCS-2 registry on ${network}...\n`);

  const client =
    network === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId!),
    PrivateKey.fromStringED25519(operatorKey!)
  );

  // Step 1: Create the registry topic
  // Memo "hcs-2" is the standard identifier for an HCS-2 topic registry.
  const createTx = await new TopicCreateTransaction()
    .setTopicMemo("hcs-2")
    .setSubmitKey(PrivateKey.fromStringED25519(operatorKey!).publicKey)
    .execute(client);

  const createReceipt = await createTx.getReceipt(client);
  const registryTopicId = createReceipt.topicId?.toString();

  if (!registryTopicId) {
    console.error("Failed to get registry topic ID from receipt");
    process.exit(1);
  }

  console.log(`Registry topic created: ${registryTopicId}\n`);

  // Step 2: Register the main attestation topic into the registry
  const registrationMessage = {
    p: "hcs-2",
    op: "register",
    t_id: "0.0.10301350",
    metadata: {
      name: "Signal Archive — Tweet Attestations",
      description:
        "SHA-256 content hashes of archived tweets from tracked public figures, submitted at time of capture. Each message proves a tweet existed with specific content at a specific time.",
      role: "attestations",
      status: "active",
      network: "mainnet",
      website: "https://signalarchive.org",
      verifyPath: "https://signalarchive.org/verify",
    },
    m: "Signal Archive primary attestation topic",
  };

  const submitTx = await new TopicMessageSubmitTransaction()
    .setTopicId(registryTopicId)
    .setMessage(JSON.stringify(registrationMessage))
    .execute(client);

  const submitReceipt = await submitTx.getReceipt(client);
  const sequenceNumber = submitReceipt.topicSequenceNumber?.toNumber();

  console.log(`Registration message submitted — seq=${sequenceNumber}\n`);
  console.log("--- Next steps ---");
  console.log(`Registry topic ID: ${registryTopicId}`);
  console.log(`Hardcode this in apps/web/app/registry/page.tsx`);
  console.log(`HashScan: https://hashscan.io/${network}/topic/${registryTopicId}`);

  client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
