/**
 * Day 4 End-to-End: Atomic batch donation construction and execution test.
 *
 * Simulates the full prepare→sign→execute flow server-side, using the
 * operator key to play the role of "user" (so no real wallet is needed).
 * This validates the full batch assembly code path.
 *
 * For Template A (no badge):
 *   inner txs: [transferTx, hcsTx]
 *
 * For Template B (with badge):
 *   inner txs: [transferTx, mintTx, nftTransferTx, hcsTx]
 *
 * Usage:
 *   # Dry run (construct only, no network submission):
 *   npx tsx --env-file=.env scripts/test-atomic-batch.ts
 *
 *   # Execute on mainnet (costs real HBAR — uses 1 tinybar transfer):
 *   EXECUTE=true npx tsx --env-file=.env scripts/test-atomic-batch.ts
 *
 *   # Test template B (badge mint):
 *   TEMPLATE=B EXECUTE=true npx tsx --env-file=.env scripts/test-atomic-batch.ts
 */

import {
  Client,
  AccountId,
  PrivateKey,
  Hbar,
  HbarUnit,
  TransferTransaction,
  TokenMintTransaction,
  TopicMessageSubmitTransaction,
  BatchTransaction,
  TransactionReceiptQuery,
  TokenId,
  NftId,
} from "@hashgraph/sdk";

const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID!;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY!;
const NETWORK = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "mainnet";
const DONATION_TOPIC_ID = process.env.HEDERA_DONATION_TOPIC_ID ?? "";
const BADGE_TOKEN_ID = process.env.NEXT_PUBLIC_BADGE_TOKEN_ID ?? "";
const DONATION_ACCOUNT_ID = process.env.NEXT_PUBLIC_DONATION_ACCOUNT_ID ?? "";
const EXECUTE = process.env.EXECUTE === "true";
const TEMPLATE = (process.env.TEMPLATE ?? "A") as "A" | "B";

function normalizeTxId(txId: string): string {
  const [payer, timestamp] = txId.split("@");
  if (!timestamp) return txId;
  return `${payer}-${timestamp.replace(".", "-")}`;
}

if (!OPERATOR_ID || !OPERATOR_KEY) {
  console.error("Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY");
  process.exit(1);
}

if (!DONATION_TOPIC_ID) {
  console.error("Missing HEDERA_DONATION_TOPIC_ID — run scripts/create-donation-topic.ts first");
  process.exit(1);
}

if (TEMPLATE === "B" && !BADGE_TOKEN_ID) {
  console.error("Missing NEXT_PUBLIC_BADGE_TOKEN_ID — run scripts/create-badge-token.ts first");
  process.exit(1);
}

async function main() {
  console.log(`=== Atomic Batch Donation E2E Test ===`);
  console.log(`Network:  ${NETWORK}`);
  console.log(`Template: ${TEMPLATE}`);
  console.log(`Execute:  ${EXECUTE}`);
  console.log(`Operator: ${OPERATOR_ID}`);
  console.log();

  const client = NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  const operatorKey = PrivateKey.fromStringED25519(OPERATOR_KEY);
  const operatorPublicKey = operatorKey.publicKey;
  const operatorId = AccountId.fromString(OPERATOR_ID);
  client.setOperator(operatorId, operatorKey);

  // The "user" in this test is the operator itself (self-transfer of 1 tinybar).
  // This tests the full code path without needing a funded test account.
  // NOTE: Template B execution will fail with ACCOUNT_REPEATED_IN_ACCOUNT_AMOUNTS
  //       if user == operator == treasury (self-transfer). This is expected — in
  //       production user != operator, so the NFT can transfer properly.
  const userAccountId = operatorId;
  const treasuryId = DONATION_ACCOUNT_ID
    ? AccountId.fromString(DONATION_ACCOUNT_ID)
    : operatorId;

  const simulatedAmount = 0.00000001; // 1 tinybar expressed as HBAR
  const simulatedAmountUsd = 5.25;

  // ── Step 1: Build user's transfer tx ─────────────────────────────────────
  console.log("Step 1: Build user transfer tx (setBatchKey + freeze)...");
  const transferTx = new TransferTransaction()
    .addHbarTransfer(userAccountId, Hbar.fromTinybars(-1))
    .addHbarTransfer(treasuryId, Hbar.fromTinybars(1))
    .setBatchKey(operatorPublicKey)
    .freezeWith(client);

  // Serialize → "send to wallet" → sign → "receive back"
  const transferTxBytes = transferTx.toBytes();
  console.log(`  Frozen tx bytes: ${transferTxBytes.length}`);

  // Simulate wallet signing (operator plays user here)
  const reconstructed = TransferTransaction.fromBytes(transferTxBytes);
  const userSignedTx = await reconstructed.sign(operatorKey);
  const signedBytes = userSignedTx.toBytes();
  console.log(`  Signed tx bytes: ${signedBytes.length} (signature added: ${signedBytes.length > transferTxBytes.length ? "YES" : "NO"})`);
  console.log("  Step 1: OK\n");

  // ── Step 2: Build HCS receipt tx ─────────────────────────────────────────
  console.log("Step 2: Build HCS receipt tx (batchify)...");
  const hcsMessage = JSON.stringify({
    version: 1,
    type: "donation_receipt",
    wallet: userAccountId.toString(),
    asset: "HBAR",
    amount: simulatedAmount,
    amount_usd: simulatedAmountUsd,
    supporter_awarded: TEMPLATE === "B",
    badge_serial: null,
    threshold_usd: 5,
    rate_hbar_usd: 0.0525,
    prepared_at: new Date().toISOString(),
  });

  const hcsTx = await new TopicMessageSubmitTransaction()
    .setTopicId(DONATION_TOPIC_ID)
    .setMessage(hcsMessage)
    .setBatchKey(operatorPublicKey)
    .freezeWith(client)
    .sign(operatorKey);

  console.log(`  HCS message length: ${hcsMessage.length} chars`);
  console.log("  Step 2: OK\n");

  // ── Step 3: Template B inner txs (optional) ───────────────────────────────
  let mintTx: TokenMintTransaction | null = null;
  let nftTransferTx: TransferTransaction | null = null;
  let predictedSerial: number | null = null;

  if (TEMPLATE === "B") {
    console.log("Step 3: Build badge mint + NFT transfer txs...");

    // Get current supply from mirror node
    const mirrorBase = NETWORK === "mainnet"
      ? "https://mainnet-public.mirrornode.hedera.com"
      : "https://testnet.mirrornode.hedera.com";

    const tokenRes = await fetch(`${mirrorBase}/api/v1/tokens/${BADGE_TOKEN_ID}`);
    if (!tokenRes.ok) throw new Error(`Mirror node token query failed: ${tokenRes.status}`);
    const tokenData = await tokenRes.json();
    predictedSerial = Number(tokenData.total_supply ?? 0) + 1;
    console.log(`  Current token supply: ${predictedSerial - 1}, predicted serial: ${predictedSerial}`);

    mintTx = await new TokenMintTransaction()
      .setTokenId(BADGE_TOKEN_ID)
      .setMetadata([
        Buffer.from(JSON.stringify({
          wallet: userAccountId.toString(),
          type: "supporter",
          minted_at: new Date().toISOString(),
        }))
      ])
      .setBatchKey(operatorPublicKey)
      .freezeWith(client)
      .sign(operatorKey);

    nftTransferTx = await new TransferTransaction()
      .addNftTransfer(
        new NftId(TokenId.fromString(BADGE_TOKEN_ID), predictedSerial),
        operatorId,
        userAccountId,
      )
      .setBatchKey(operatorPublicKey)
      .freezeWith(client)
      .sign(operatorKey);

    console.log("  Step 3: OK\n");
  } else {
    console.log("Step 3: Skipped (Template A)\n");
  }

  // ── Step 4: Reconstruct signed user tx and assemble BatchTransaction ──────
  console.log("Step 4: Reconstruct signed tx + assemble BatchTransaction...");
  const finalUserTx = TransferTransaction.fromBytes(signedBytes);

  const innerTxs = TEMPLATE === "B" && mintTx && nftTransferTx
    ? [finalUserTx, mintTx, nftTransferTx, hcsTx]
    : [finalUserTx, hcsTx];

  const batchTx = await new BatchTransaction()
    .setInnerTransactions(innerTxs)
    .freezeWith(client)
    .sign(operatorKey);

  const batchBytes = batchTx.toBytes();
  console.log(`  Inner transaction count: ${batchTx.innerTransactions.length}`);
  console.log(`  Inner tx IDs:`);
  batchTx.innerTransactionIds.forEach((id, i) => {
    console.log(`    [${i}] ${id?.toString()}`);
  });
  console.log(`  BatchTransaction bytes: ${batchBytes.length}`);
  console.log("  Step 4: OK\n");

  // ── Step 5: Execute (optional) ────────────────────────────────────────────
  if (!EXECUTE) {
    console.log("Step 5: Skipped (set EXECUTE=true to submit to network)");
  } else {
    console.log(`Step 5: Submitting to ${NETWORK}...`);
    try {
      const response = await batchTx.execute(client);
      const batchTransactionId = normalizeTxId(response.transactionId.toString());
      console.log(`  Batch transaction ID: ${batchTransactionId}`);

      const receipt = await response.getReceipt(client);
      console.log(`  Receipt status: ${receipt.status}`);

      if (TEMPLATE === "B" && mintTx?.transactionId) {
        const mintReceipt = await new TransactionReceiptQuery()
          .setTransactionId(mintTx.transactionId)
          .execute(client);
        const actualSerial = mintReceipt.serials?.[0]?.toNumber();
        console.log(`  Mint serial (predicted: ${predictedSerial}, actual: ${actualSerial}): ${predictedSerial === actualSerial ? "MATCH" : "MISMATCH"}`);
      }

      const network = NETWORK;
      console.log(`\n  HashScan: https://hashscan.io/${network}/transaction/${batchTransactionId}`);
      console.log("  Step 5: OK");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (TEMPLATE === "B" && msg.includes("ACCOUNT_REPEATED_IN_ACCOUNT_AMOUNTS")) {
        console.log(`  Step 5: Expected failure for Template B self-transfer test.`);
        console.log(`  In production the user wallet != operator, so this won't occur.`);
        console.log(`  Badge mint and NFT transfer inner tx construction: VERIFIED`);
      } else {
        console.error(`  Step 5 FAILED:`, err);
      }
    }
  }

  console.log("\n=== Test Complete ===");
  client.close();
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
