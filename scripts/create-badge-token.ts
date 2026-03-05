/**
 * Creates the Signal Archive supporter badge NFT token on Hedera.
 *
 * Token properties:
 *   - Type: NON_FUNGIBLE_UNIQUE (NFT)
 *   - Name: Signal Archive Supporter
 *   - Symbol: SABADGE
 *   - Treasury: operator account
 *   - Supply key: operator (enables future minting)
 *   - No max supply (infinite)
 *   - No freeze / wipe keys (keep it simple)
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/create-badge-token.ts
 *   HEDERA_NETWORK=mainnet npx tsx --env-file=.env scripts/create-badge-token.ts
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

if (!OPERATOR_ID || !OPERATOR_KEY) {
  console.error("Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY");
  process.exit(1);
}

async function main() {
  console.log(`Creating badge NFT token on ${NETWORK}...\n`);

  const client =
    NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  const operatorKey = PrivateKey.fromStringED25519(OPERATOR_KEY!);
  client.setOperator(AccountId.fromString(OPERATOR_ID!), operatorKey);

  const tx = await new TokenCreateTransaction()
    .setTokenName("Signal Archive Supporter")
    .setTokenSymbol("SABADGE")
    .setTokenType(TokenType.NonFungibleUnique)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(AccountId.fromString(OPERATOR_ID!))
    .setSupplyKey(operatorKey.publicKey)
    .setTokenMemo("Signal Archive supporter badge — https://signalarchive.org")
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const tokenId = receipt.tokenId?.toString();

  console.log(`Badge token created: ${tokenId}`);
  console.log(`\nAdd to Railway web env vars:`);
  console.log(`  NEXT_PUBLIC_BADGE_TOKEN_ID=${tokenId}`);
  console.log(`\nAdd to Railway worker env vars (if needed):`);
  console.log(`  BADGE_TOKEN_ID=${tokenId}`);

  client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
