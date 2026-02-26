/**
 * Updates twitter IDs for accounts that had placeholder values.
 * Usage: npx tsx scripts/update-twitter-ids.ts
 */

import { getDb, trackedAccounts } from "@taa/db";
import { eq } from "drizzle-orm";

const CONFIRMED_IDS: Record<string, string> = {
  LaraLeaTrump:    "75541946",
  SteveWitkoff:    "1813545855028277248",
  JaredKushner:    "245963716",
  worldlibertyfi:  "1816138985342705664",
  ChaseHerro:      "222583396",
  ZakFolkman:      "1349771918698819586",
  Kash_Patel:      "1863271160747610112",
  PamBondi:        "93755660",
  RobertKennedyJr: "337808606",
  SebGorka:        "2417586104",
  PressSec:        "1879670389057474560",
  SenLummis:       "22831059",
};

async function main() {
  const db = getDb();
  console.log("Updating confirmed Twitter IDs...\n");

  for (const [username, twitterId] of Object.entries(CONFIRMED_IDS)) {
    await db
      .update(trackedAccounts)
      .set({ twitterId, updatedAt: new Date() })
      .where(eq(trackedAccounts.username, username));
    console.log(`  [ok] @${username} → ${twitterId}`);
  }

  console.log(`\nDone: ${Object.keys(CONFIRMED_IDS).length} accounts updated`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
