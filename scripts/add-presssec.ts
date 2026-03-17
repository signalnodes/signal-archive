/**
 * Add @PressSec (Karoline Leavitt, White House Press Secretary) to tracked accounts.
 *
 * Usage: npx tsx --env-file=.env scripts/add-presssec.ts
 */

import { getDb, trackedAccounts } from "@taa/db";

async function main() {
  const db = getDb();

  await db
    .insert(trackedAccounts)
    .values({
      twitterId: "1879670389057474560",
      username: "PressSec",
      displayName: "Press Secretary Karoline Leavitt",
      category: "white_house",
      trackingTier: "priority",
      metadata: { role: "White House Press Secretary" },
    })
    .onConflictDoUpdate({
      target: trackedAccounts.twitterId,
      set: {
        username: "PressSec",
        isActive: true,
        updatedAt: new Date(),
      },
    });

  console.log("[ok] Added @PressSec (id: 1879670389057474560)");
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
