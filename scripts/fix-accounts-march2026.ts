/**
 * One-time account corrections — March 2026
 *
 * Changes:
 *   1. Deactivate @justinsun (wrong account — correct one is @justinsuntron, already seeded)
 *   2. Update @RepTomEmmer → @GOPMajorityWhip (Tom Emmer's active account)
 *   3. Add @AGPamBondi (Pam Bondi's official AG account)
 *   4. Add @JDVance (JD Vance's personal account, in addition to @VP)
 *
 * Usage: npx tsx --env-file=.env scripts/fix-accounts-march2026.ts
 */

import { getDb, trackedAccounts } from "@taa/db";
import { eq } from "drizzle-orm";

async function main() {
  const db = getDb();

  // 1. Deactivate @justinsun — wrong account, @justinsuntron is already tracked
  const deactivated = await db
    .update(trackedAccounts)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(trackedAccounts.username, "justinsun"))
    .returning({ username: trackedAccounts.username });

  if (deactivated.length > 0) {
    console.log(`[ok] Deactivated @justinsun`);
  } else {
    console.log(`[skip] @justinsun not found (already removed?)`);
  }

  // 2. Update @RepTomEmmer → @GOPMajorityWhip
  const updated = await db
    .update(trackedAccounts)
    .set({
      username: "GOPMajorityWhip",
      displayName: "Tom Emmer",
      updatedAt: new Date(),
    })
    .where(eq(trackedAccounts.username, "RepTomEmmer"))
    .returning({ username: trackedAccounts.username });

  if (updated.length > 0) {
    console.log(`[ok] Updated @RepTomEmmer → @GOPMajorityWhip`);
  } else {
    console.log(`[skip] @RepTomEmmer not found`);
  }

  // 3. Add @AGPamBondi — Pam Bondi's official AG account
  await db
    .insert(trackedAccounts)
    .values({
      twitterId: "0300000009", // placeholder — run lookup-twitter-ids to resolve
      username: "AGPamBondi",
      displayName: "AG Pam Bondi",
      category: "political_appointee",
      trackingTier: "priority",
      metadata: { role: "Attorney General (official account)" },
    })
    .onConflictDoUpdate({
      target: trackedAccounts.twitterId,
      set: {
        username: "AGPamBondi",
        isActive: true,
        updatedAt: new Date(),
      },
    });
  console.log(`[ok] Added @AGPamBondi`);

  // 4. Add @JDVance — JD Vance's personal account (in addition to @VP)
  await db
    .insert(trackedAccounts)
    .values({
      twitterId: "2336787612", // JD Vance personal account
      username: "JDVance",
      displayName: "JD Vance",
      category: "white_house",
      trackingTier: "priority",
      metadata: { role: "Vice President (personal account)" },
    })
    .onConflictDoUpdate({
      target: trackedAccounts.twitterId,
      set: {
        username: "JDVance",
        isActive: true,
        updatedAt: new Date(),
      },
    });
  console.log(`[ok] Added @JDVance`);

  console.log("\nDone. Run check-ingest-gap.ts to verify.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fix failed:", err);
  process.exit(1);
});
