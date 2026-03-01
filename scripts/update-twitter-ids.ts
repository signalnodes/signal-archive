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
  // Fixed: was placeholder 0500000003
  SECGov:          "18479955",
};

// Handle corrections: { oldUsername -> newUsername }
const HANDLE_CORRECTIONS: Record<string, string> = {
  justinsuntron: "justinsun",
};

async function main() {
  const db = getDb();
  console.log("Updating confirmed Twitter IDs...\n");

  for (const [username, twitterId] of Object.entries(CONFIRMED_IDS)) {
    try {
      await db
        .update(trackedAccounts)
        .set({ twitterId, updatedAt: new Date() })
        .where(eq(trackedAccounts.username, username));
      console.log(`  [ok] @${username} → ${twitterId}`);
    } catch (err: any) {
      if (err?.code === "23505") {
        console.log(`  [skip] @${username} — ID already applied`);
      } else {
        throw err;
      }
    }
  }

  console.log("\nApplying handle corrections...\n");

  for (const [oldUsername, newUsername] of Object.entries(HANDLE_CORRECTIONS)) {
    await db
      .update(trackedAccounts)
      .set({ username: newUsername, updatedAt: new Date() })
      .where(eq(trackedAccounts.username, oldUsername));
    console.log(`  [ok] @${oldUsername} → @${newUsername}`);
  }

  console.log(`\nDone.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
