/**
 * Repairs badge serials whose on-chain metadata was not updated to the server URL.
 * This happens when the TokenUpdateNftsTransaction step in execute/route.ts fails
 * after a successful mint+transfer.
 *
 * Queries the DB for all confirmed Template B donations with a badgeSerial,
 * checks the mirror node metadata for each serial, and re-runs the update
 * for any that still have the placeholder value.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/repair-badge-metadata.ts
 *   npx tsx --env-file=.env scripts/repair-badge-metadata.ts --dry-run
 */

import {
  Client,
  AccountId,
  PrivateKey,
  TokenId,
  TokenUpdateNftsTransaction,
  Long,
} from "@hashgraph/sdk";
import { getDb, supporters } from "@taa/db";
import { isNotNull } from "drizzle-orm";

const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID!;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY!;
const NETWORK = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "mainnet";
const BADGE_TOKEN_ID = process.env.NEXT_PUBLIC_BADGE_TOKEN_ID ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://signalarchive.org";
const DRY_RUN = process.argv.includes("--dry-run");

const mirrorBase =
  NETWORK === "mainnet"
    ? "https://mainnet-public.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";

if (!OPERATOR_ID || !OPERATOR_KEY) {
  console.error("Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY");
  process.exit(1);
}
if (!BADGE_TOKEN_ID) {
  console.error("Missing NEXT_PUBLIC_BADGE_TOKEN_ID");
  process.exit(1);
}

async function getOnChainMetadata(serial: number): Promise<string | null> {
  const res = await fetch(
    `${mirrorBase}/api/v1/tokens/${BADGE_TOKEN_ID}/nfts/${serial}`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  // Mirror node returns metadata as base64
  if (!data.metadata) return null;
  return Buffer.from(data.metadata, "base64").toString("utf8");
}

async function main() {
  console.log(`=== Badge Metadata Repair ===`);
  console.log(`Network:   ${NETWORK}`);
  console.log(`Token:     ${BADGE_TOKEN_ID}`);
  console.log(`App URL:   ${APP_URL}`);
  console.log(`Dry run:   ${DRY_RUN}`);
  console.log();

  const db = getDb();
  const rows = await db
    .select({
      walletAddress: supporters.walletAddress,
      badgeSerial: supporters.badgeSerial,
    })
    .from(supporters)
    .where(isNotNull(supporters.badgeSerial));

  console.log(`Found ${rows.length} supporter(s) with a badge serial.\n`);

  const client = NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  const operatorKey = PrivateKey.fromStringED25519(OPERATOR_KEY);
  client.setOperator(AccountId.fromString(OPERATOR_ID), operatorKey);

  let repaired = 0;
  let skipped = 0;

  for (const row of rows) {
    const serial = parseInt(row.badgeSerial!, 10);
    const expectedUrl = `${APP_URL}/api/nft/${serial}`;

    const current = await getOnChainMetadata(serial);
    console.log(`Serial #${serial} (${row.walletAddress})`);
    console.log(`  Current metadata: ${current ?? "(null)"}`);

    if (current === expectedUrl) {
      console.log(`  OK — already set correctly.\n`);
      skipped++;
      continue;
    }

    console.log(`  Needs update → ${expectedUrl}`);

    if (DRY_RUN) {
      console.log(`  [dry-run] Skipping update.\n`);
      continue;
    }

    try {
      const updateTx = await new TokenUpdateNftsTransaction()
        .setTokenId(TokenId.fromString(BADGE_TOKEN_ID))
        .setSerialNumbers([Long.fromNumber(serial)])
        .setMetadata(Buffer.from(expectedUrl))
        .freezeWith(client)
        .sign(operatorKey);

      const response = await updateTx.execute(client);
      await response.getReceipt(client);
      console.log(`  Updated successfully.\n`);
      repaired++;
    } catch (err) {
      console.error(`  FAILED:`, err instanceof Error ? err.message : err, "\n");
    }
  }

  console.log(`Done. Repaired: ${repaired}, Already correct: ${skipped}`);
  client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
