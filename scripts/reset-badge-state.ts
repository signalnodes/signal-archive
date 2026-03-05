/**
 * Clears the badge fields for a wallet address so template B can re-trigger.
 * Use this when a badge was written to the DB optimistically but never actually minted.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/reset-badge-state.ts <walletAddress>
 */

import { getDb, supporters, donations } from "@taa/db";
import { eq } from "drizzle-orm";

const walletAddress = process.argv[2];
if (!walletAddress) {
  console.error("Usage: npx tsx --env-file=.env scripts/reset-badge-state.ts <walletAddress>");
  process.exit(1);
}

async function main() {
  const db = getDb();

  const result = await db
    .update(supporters)
    .set({
      badgeTokenId: null,
      badgeSerial: null,
      badgeAwardedAt: null,
    })
    .where(eq(supporters.walletAddress, walletAddress))
    .returning({ walletAddress: supporters.walletAddress });

  if (result.length === 0) {
    console.log(`No supporter record found for ${walletAddress}`);
  } else {
    console.log(`Badge state cleared for ${walletAddress}`);
  }

  // Also show pending donations for reference
  const rows = await db
    .select()
    .from(donations)
    .where(eq(donations.walletAddress, walletAddress));

  console.log(`\nDonation records (${rows.length}):`);
  for (const r of rows) {
    console.log(`  ${r.transactionId} | ${r.asset} ${r.amount} | status=${r.status} | template=${r.template} | badgeSerial=${r.badgeSerial}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
