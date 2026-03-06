/**
 * Creates the Signal Archive supporter badge NFT token on Hedera.
 *
 * Key design (all set to operator key):
 *   - Admin key: update token config or burn keys later for immutability
 *   - Supply key: mint new serials
 *   - Metadata key: update per-NFT metadata URIs (HIP-657)
 *   - Wipe key: revoke a badge (e.g. compromised account)
 *   - Freeze key: freeze an individual account's token balance
 *   - Pause key: emergency pause of the entire token
 *   - No KYC key — no KYC required
 *
 * Supply: FINITE, max 500 (founding tier). IMMUTABLE after creation — cannot be raised or converted
 * to infinite. A new token would be required for any future tier beyond 500.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/create-badge-token.ts
 *   HEDERA_NETWORK=mainnet npx tsx --env-file=.env scripts/create-badge-token.ts
 *
 * Optional: pass an IPFS CID to print the metadata URI reminder:
 *   npx tsx --env-file=.env scripts/create-badge-token.ts QmXXX...
 */

import {
  Client,
  AccountId,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
} from "@hashgraph/sdk";

const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY;
const NETWORK = process.env.HEDERA_NETWORK ?? "testnet";
const metadataCid = process.argv[2] ?? null;

if (!OPERATOR_ID || !OPERATOR_KEY) {
  console.error("Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY");
  process.exit(1);
}

const hashscanBase =
  NETWORK === "mainnet" ? "https://hashscan.io/mainnet" : "https://hashscan.io/testnet";

async function main() {
  console.log(`Creating badge NFT token on ${NETWORK}...`);
  if (metadataCid) console.log(`Metadata CID: ${metadataCid}`);
  console.log();

  const client =
    NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  const operatorKey = PrivateKey.fromStringED25519(OPERATOR_KEY!);
  const operatorId = AccountId.fromString(OPERATOR_ID!);
  client.setOperator(operatorId, operatorKey);

  const tx = await new TokenCreateTransaction()
    .setTokenName("Signal Archive Supporter")
    .setTokenSymbol("SIGBADGE")
    .setTokenType(TokenType.NonFungibleUnique)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(500)
    .setTreasuryAccountId(operatorId)
    // All keys set to operator — can be burned later via TokenUpdateTransaction
    .setAdminKey(operatorKey.publicKey)    // update token config / burn keys
    .setSupplyKey(operatorKey.publicKey)   // mint new serials
    .setMetadataKey(operatorKey.publicKey) // update per-NFT metadata (HIP-657)
    .setWipeKey(operatorKey.publicKey)     // revoke badge from an account
    .setFreezeKey(operatorKey.publicKey)   // freeze an account's balance
    .setPauseKey(operatorKey.publicKey)    // emergency pause entire token
    // No KYC key
    .setTokenMemo("Signal Archive supporter badge — https://signalarchive.org")
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const tokenId = receipt.tokenId?.toString();

  console.log(`Token created: ${tokenId}`);
  console.log(`HashScan:      ${hashscanBase}/token/${tokenId}`);

  console.log(`\n--- Railway env vars ---`);
  console.log(`NEXT_PUBLIC_BADGE_TOKEN_ID=${tokenId}`);

  if (metadataCid) {
    console.log(`\n--- execute/route.ts metadata line ---`);
    console.log(`Buffer.from("ipfs://${metadataCid}")`);
  } else {
    console.log(`\nOnce art is pinned to IPFS, update execute/route.ts:`);
    console.log(`  Buffer.from("ipfs://<your-metadata-cid>")`);
    console.log(`Then re-run this script with the CID as an argument to print it.`);
  }

  client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
