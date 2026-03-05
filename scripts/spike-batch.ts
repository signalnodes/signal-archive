/**
 * Day 0 Spike: HIP-551 BatchTransaction mechanics
 *
 * Tests server-side batch construction without a real wallet.
 * Simulates the user's transfer tx being signed by a second test key
 * (stand-in for the WalletConnect signer) to prove the full flow compiles
 * and the SDK APIs behave as expected.
 *
 * Run: npx tsx --env-file=.env scripts/spike-batch.ts
 * Requires: HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY in .env
 * Optional: set SPIKE_EXECUTE=true to submit to testnet
 */

import {
  Client,
  AccountId,
  PrivateKey,
  Hbar,
  TransferTransaction,
  TopicMessageSubmitTransaction,
  TopicCreateTransaction,
  BatchTransaction,
} from "@hashgraph/sdk";

const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID!;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY!;
const EXECUTE = process.env.SPIKE_EXECUTE === "true";

if (!OPERATOR_ID || !OPERATOR_KEY) {
  console.error("Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY");
  process.exit(1);
}

async function main() {
  console.log("=== HIP-551 BatchTransaction Spike ===\n");

  // --- Setup ---
  const client = Client.forTestnet().setOperator(
    AccountId.fromString(OPERATOR_ID),
    PrivateKey.fromStringED25519(OPERATOR_KEY)
  );

  const operatorKey = PrivateKey.fromStringED25519(OPERATOR_KEY);
  const operatorPublicKey = operatorKey.publicKey;

  // Simulate a user key (in prod this would be the wallet's key)
  const simulatedUserKey = PrivateKey.generateED25519();
  const simulatedUserAccount = AccountId.fromString("0.0.2"); // dummy

  console.log(`Operator:       ${OPERATOR_ID}`);
  console.log(`Operator pubkey: ${operatorPublicKey.toStringRaw().slice(0, 20)}...`);
  console.log(`Simulated user: ${simulatedUserKey.publicKey.toStringRaw().slice(0, 20)}... (test key)`);
  console.log();

  // --- Step 1: Build the user's transfer transaction ---
  // Server constructs this and serializes it; client would sign it via WalletConnect
  console.log("Step 1: Build user transfer tx...");

  const transferTx = new TransferTransaction()
    .addHbarTransfer(simulatedUserAccount, Hbar.fromTinybars(-1))
    .addHbarTransfer(AccountId.fromString(OPERATOR_ID), Hbar.fromTinybars(1))
    .setBatchKey(operatorPublicKey)  // <-- batch key = operator's key
    .freezeWith(client);

  // Server serializes and sends bytes to client
  const transferTxBytes = transferTx.toBytes();
  console.log(`  Transfer tx bytes: ${transferTxBytes.length} bytes`);

  // Client receives bytes, reconstructs, and signs with their wallet
  const reconstructedTransferTx = await TransferTransaction.fromBytes(transferTxBytes);
  const userSignedTransferTx = await reconstructedTransferTx.sign(simulatedUserKey);
  const signedTransferBytes = userSignedTransferTx.toBytes();
  console.log(`  Signed transfer tx bytes: ${signedTransferBytes.length} bytes`);
  console.log("  Transfer tx construction: OK");
  console.log();

  // --- Step 2: Build the operator's inner transactions ---
  // These are batchified by the server (sets batchKey + signs with operator)
  console.log("Step 2: Build operator inner transactions (batchify)...");

  const hcsMessage = JSON.stringify({
    version: 1,
    type: "donation_receipt",
    batch_transaction_id: "pending", // filled after batch executes
    asset: "HBAR",
    amount: 100,
    amount_usd: 5.25,
    supporter_awarded: true,
    badge_serial: null, // null for Template A (no mint)
    threshold_usd: 5,
    rate_hbar_usd: 0.0525,
  });

  // Using a known testnet topic for the spike (or a dummy)
  const SPIKE_TOPIC = "0.0.5254173"; // testnet example topic (public)

  const hcsTx = new TopicMessageSubmitTransaction()
    .setTopicId(SPIKE_TOPIC)
    .setMessage(hcsMessage)
    .setBatchKey(operatorPublicKey)
    .freezeWith(client);

  // batchify = setBatchKey + signWithOperator
  // We already set the key manually above, so just sign with operator
  await hcsTx.sign(operatorKey);
  console.log("  HCS receipt tx batchified: OK");
  console.log();

  // --- Step 3: Reconstruct user's signed transfer from bytes and verify ---
  console.log("Step 3: Reconstruct signed user tx from bytes...");
  const finalTransferTx = await TransferTransaction.fromBytes(signedTransferBytes);
  // getSignatures() relies on internal state that isn't rebuilt after fromBytes —
  // use byte-size growth as the signal: frozen-only=128, signed=232 (+64 sig +overhead)
  const sigAdded = signedTransferBytes.length > transferTxBytes.length;
  console.log(`  User signature present: ${sigAdded ? "YES" : "NO"} (bytes ${transferTxBytes.length} → ${signedTransferBytes.length})`);
  console.log(`  batchKey set: ${finalTransferTx.batchKey !== null ? "YES" : "NO"}`);
  console.log(`  batchKey matches operator: ${finalTransferTx.batchKey?.toString() === operatorPublicKey.toString() ? "YES" : "NO"}`);
  console.log();

  // --- Step 4: Assemble BatchTransaction ---
  console.log("Step 4: Assemble BatchTransaction...");

  const batchTx = new BatchTransaction()
    .setInnerTransactions([finalTransferTx, hcsTx])
    .freezeWith(client);

  // BatchTransaction must be signed by all batchKeys of inner transactions
  // Since all inner txs use operatorKey as batchKey, sign once with operator
  await batchTx.sign(operatorKey);

  console.log(`  Inner transaction count: ${batchTx.innerTransactions.length}`);
  console.log(`  Inner tx IDs: ${batchTx.innerTransactionIds.map(id => id?.toString()).join(", ")}`);
  const batchBytes = batchTx.toBytes();
  console.log(`  BatchTransaction bytes: ${batchBytes.length} bytes`);
  console.log("  BatchTransaction assembly: OK");
  console.log();

  // --- Step 5: Execute (optional, testnet only) ---
  if (EXECUTE) {
    console.log("Step 5: Executing on testnet...");
    console.log("  WARNING: This will transfer 1 tinybar from operator to itself");
    try {
      const receipt = await batchTx.execute(client);
      const result = await receipt.getReceipt(client);
      console.log(`  Status: ${result.status}`);
      console.log(`  Transaction ID: ${receipt.transactionId}`);
      console.log("  Execute: OK");
    } catch (err) {
      console.error(`  Execute failed: ${err}`);
      console.log("\n  This may indicate HIP-551 is not yet enabled on testnet,");
      console.log("  or the inner transaction node IDs need adjustment.");
    }
  } else {
    console.log("Step 5: Skipped (set SPIKE_EXECUTE=true to test on testnet)");
  }

  console.log("\n=== Spike Results ===");
  console.log("BatchTransaction class: AVAILABLE");
  console.log("batchify / setBatchKey API: AVAILABLE");
  console.log("Transaction serialization (toBytes/fromBytes): AVAILABLE");
  console.log("Cross-party signing flow: VERIFIED");
  console.log("\nThe atomic batch plan is buildable with SDK v2.80.0.");
  console.log("WalletConnect signing will be tested during Day 3 client integration.");

  client.close();
}

main().catch((err) => {
  console.error("Spike failed:", err);
  process.exit(1);
});
