/**
 * Tests the current production batch approach for Template B:
 *   BatchTransaction([mintTx, hcsTx])
 *
 * If this succeeds, the mint+HCS batch works and the issue was elsewhere.
 * If this fails, it prints the exact Hedera consensus error.
 *
 * After a successful batch, runs a separate NFT transfer to the operator
 * (self-transfer is fine here since we're just testing the mechanism).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/test-batch-mint.ts
 */

import {
  Client,
  AccountId,
  PrivateKey,
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

if (!OPERATOR_ID || !OPERATOR_KEY) {
  console.error("Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY");
  process.exit(1);
}
if (!DONATION_TOPIC_ID || !BADGE_TOKEN_ID) {
  console.error("Missing HEDERA_DONATION_TOPIC_ID or NEXT_PUBLIC_BADGE_TOKEN_ID");
  process.exit(1);
}

const mirrorBase = NETWORK === "mainnet"
  ? "https://mainnet-public.mirrornode.hedera.com"
  : "https://testnet.mirrornode.hedera.com";

function normalizeTxId(txId: string): string {
  const [payer, timestamp] = txId.split("@");
  if (!timestamp) return txId;
  return `${payer}-${timestamp.replace(".", "-")}`;
}

async function main() {
  console.log(`=== Batch Mint Test ([mintTx, hcsTx]) ===`);
  console.log(`Network:    ${NETWORK}`);
  console.log(`Operator:   ${OPERATOR_ID}`);
  console.log(`Badge token: ${BADGE_TOKEN_ID}`);
  console.log(`Topic:      ${DONATION_TOPIC_ID}`);
  console.log();

  const client = NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  const operatorKey = PrivateKey.fromStringED25519(OPERATOR_KEY);
  const operatorPublicKey = operatorKey.publicKey;
  const operatorId = AccountId.fromString(OPERATOR_ID);
  client.setOperator(operatorId, operatorKey);

  // Get current supply
  const tokenRes = await fetch(`${mirrorBase}/api/v1/tokens/${BADGE_TOKEN_ID}`);
  const tokenData = await tokenRes.json();
  const currentSupply = Number(tokenData.total_supply ?? 0);
  const predictedSerial = currentSupply + 1;
  console.log(`Current supply: ${currentSupply}, expected serial after mint: ${predictedSerial}\n`);

  // --- Build mintTx ---
  console.log("Building mintTx...");
  const mintTx = await new TokenMintTransaction()
    .setTokenId(BADGE_TOKEN_ID)
    .setMetadata([
      Buffer.from(JSON.stringify({
        wallet: operatorId.toString(),
        type: "supporter",
        minted_at: new Date().toISOString(),
      }))
    ])
    .setBatchKey(operatorPublicKey)
    .freezeWith(client)
    .sign(operatorKey);
  console.log(`  mintTx ID: ${mintTx.transactionId?.toString()}`);

  // --- Build hcsTx ---
  console.log("Building hcsTx...");
  const hcsTx = await new TopicMessageSubmitTransaction()
    .setTopicId(DONATION_TOPIC_ID)
    .setMessage(JSON.stringify({ type: "batch_mint_test", ts: new Date().toISOString() }))
    .setBatchKey(operatorPublicKey)
    .freezeWith(client)
    .sign(operatorKey);
  console.log(`  hcsTx ID: ${hcsTx.transactionId?.toString()}`);

  // --- Assemble batch ---
  console.log("\nAssembling BatchTransaction([mintTx, hcsTx])...");
  const batchTx = await new BatchTransaction()
    .setInnerTransactions([mintTx, hcsTx])
    .freezeWith(client)
    .sign(operatorKey);
  console.log(`  Inner tx count: ${batchTx.innerTransactions.length}`);

  // --- Execute ---
  console.log("\nSubmitting batch...");
  try {
    const response = await batchTx.execute(client);
    const batchTxId = normalizeTxId(response.transactionId.toString());
    console.log(`  Batch TX ID: ${batchTxId}`);

    const receipt = await response.getReceipt(client);
    console.log(`  Batch receipt status: ${receipt.status}`);

    // Get mint serial
    const mintReceipt = await new TransactionReceiptQuery()
      .setTransactionId(mintTx.transactionId!)
      .execute(client);
    const actualSerial = mintReceipt.serials?.[0]?.toNumber();
    console.log(`  Minted serial: ${actualSerial} (predicted: ${predictedSerial})`);
    console.log(`\n  HashScan: https://hashscan.io/${NETWORK}/transaction/${batchTxId}`);

    // --- Transfer the minted NFT to operator (self, just to test transfer) ---
    console.log("\nTransferring NFT to operator (self-transfer to verify mechanism)...");
    const transferTx = await new TransferTransaction()
      .addNftTransfer(
        new NftId(TokenId.fromString(BADGE_TOKEN_ID), actualSerial!),
        operatorId,
        operatorId,  // self-transfer just to test
      )
      .freezeWith(client)
      .sign(operatorKey);

    try {
      const tResponse = await transferTx.execute(client);
      const tReceipt = await tResponse.getReceipt(client);
      console.log(`  Transfer status: ${tReceipt.status}`);
    } catch (tErr) {
      // Self-transfer may fail with ACCOUNT_REPEATED — that's OK, mint worked
      console.log(`  Transfer note: ${tErr instanceof Error ? tErr.message : String(tErr)}`);
      console.log(`  (Self-transfer expected to fail — mint was the important part)`);
    }

    console.log("\n=== RESULT: BATCH MINT SUCCEEDED ===");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n  BATCH FAILED: ${msg}`);
    console.error(`\n=== RESULT: BATCH MINT FAILED ===`);
    console.error("Full error:", err);
  }

  client.close();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
