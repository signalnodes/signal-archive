import { getDb, supporters } from "@taa/db";

const WALLET = "0.0.1421971";
const db = getDb();
const now = new Date();

await db
  .insert(supporters)
  .values({
    walletAddress: WALLET,
    totalDonatedUsd: "0",
    firstDonationAt: now,
    lastDonationAt: now,
  })
  .onConflictDoNothing();

console.log(`Added ${WALLET} to supporters.`);
process.exit(0);
