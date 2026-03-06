/**
 * Adds a 10% royalty fee to the Signal Archive badge NFT token.
 *
 * Two-step process (both in this script):
 *   1. TokenUpdateTransaction — adds feeScheduleKey to the token (requires admin key)
 *   2. TokenFeeScheduleUpdateTransaction — sets 10% CustomRoyaltyFee with 2 HBAR fallback
 *
 * Royalty: 10% of fungible value exchanged on secondary sales, paid to operator account.
 * Fallback: 2 HBAR flat fee for transfers with no fungible exchange (wallet-to-wallet).
 *
 * Run BEFORE any secondary market trades occur.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/update-badge-fees.ts
 *   HEDERA_NETWORK=mainnet npx tsx --env-file=.env scripts/update-badge-fees.ts
 */

import {
  Client,
  AccountId,
  PrivateKey,
  TokenId,
  TokenUpdateTransaction,
  TokenFeeScheduleUpdateTransaction,
  CustomRoyaltyFee,
  CustomFixedFee,
  Hbar,
} from "@hashgraph/sdk";

const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID!;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY!;
const NETWORK = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? process.env.HEDERA_NETWORK ?? "mainnet";
const BADGE_TOKEN_ID = process.env.NEXT_PUBLIC_BADGE_TOKEN_ID ?? "";

if (!OPERATOR_ID || !OPERATOR_KEY) {
  console.error("Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY");
  process.exit(1);
}
if (!BADGE_TOKEN_ID) {
  console.error("Missing NEXT_PUBLIC_BADGE_TOKEN_ID");
  process.exit(1);
}

const hashscanBase =
  NETWORK === "mainnet" ? "https://hashscan.io/mainnet" : "https://hashscan.io/testnet";

async function main() {
  console.log(`=== Badge Royalty Fee Setup ===`);
  console.log(`Network: ${NETWORK}`);
  console.log(`Token:   ${BADGE_TOKEN_ID}`);
  console.log();

  const client = NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  const operatorKey = PrivateKey.fromStringED25519(OPERATOR_KEY);
  const operatorId = AccountId.fromString(OPERATOR_ID);
  client.setOperator(operatorId, operatorKey);
  const tokenId = TokenId.fromString(BADGE_TOKEN_ID);

  // --- Step 1: Add fee schedule key via admin key ---
  console.log("Step 1: Adding fee schedule key...");
  const updateTx = await new TokenUpdateTransaction()
    .setTokenId(tokenId)
    .setFeeScheduleKey(operatorKey.publicKey)
    .freezeWith(client)
    .sign(operatorKey); // admin key signs

  const updateResponse = await updateTx.execute(client);
  await updateResponse.getReceipt(client);
  console.log("  Fee schedule key added.\n");

  // --- Step 2: Set royalty fee ---
  console.log("Step 2: Setting 10% royalty fee with 2 HBAR fallback...");

  // Fallback: charged when NFT transfers with no fungible value exchange
  const fallbackFee = new CustomFixedFee()
    .setAmount(new Hbar(2).toTinybars())
    .setFeeCollectorAccountId(operatorId);

  const royaltyFee = new CustomRoyaltyFee()
    .setNumerator(10)
    .setDenominator(100) // 10%
    .setFeeCollectorAccountId(operatorId)
    .setFallbackFee(fallbackFee);

  const feeTx = await new TokenFeeScheduleUpdateTransaction()
    .setTokenId(tokenId)
    .setCustomFees([royaltyFee])
    .freezeWith(client)
    .sign(operatorKey); // fee schedule key signs

  const feeResponse = await feeTx.execute(client);
  await feeResponse.getReceipt(client);
  console.log("  Royalty fee set.\n");

  console.log(`Done. HashScan: ${hashscanBase}/token/${BADGE_TOKEN_ID}`);
  console.log(`  10% royalty on secondary sales → ${OPERATOR_ID}`);
  console.log(`  2 HBAR fallback on wallet-to-wallet transfers → ${OPERATOR_ID}`);

  client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
