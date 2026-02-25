/**
 * Seed tracked accounts for Phase 1.
 * Twitter IDs are placeholders — run browser lookup before real seeding.
 *
 * Usage: node --experimental-strip-types scripts/seed-accounts.ts
 */

import { getDb, trackedAccounts } from "@taa/db";
import type { AccountCategory, TrackingTier } from "@taa/shared";

interface SeedAccount {
  twitterId: string;
  username: string;
  displayName: string;
  category: AccountCategory;
  subcategory?: string;
  trackingTier: TrackingTier;
  metadata?: Record<string, unknown>;
}

const VERIFY_ID = "VERIFY_ID";

const PHASE_1_ACCOUNTS: SeedAccount[] = [
  // Category 1: Trump Family & Inner Circle (PRIORITY)
  { twitterId: VERIFY_ID, username: "realDonaldTrump", displayName: "Donald Trump", category: "trump_family", trackingTier: "priority", metadata: { role: "President, WLFI co-founder emeritus" } },
  { twitterId: VERIFY_ID, username: "MELANIATRUMP", displayName: "Melania Trump", category: "trump_family", trackingTier: "priority", metadata: { role: "First Lady, $MELANIA meme coin" } },
  { twitterId: VERIFY_ID, username: "EricTrump", displayName: "Eric Trump", category: "trump_family", trackingTier: "priority", metadata: { role: "WLFI co-founder" } },
  { twitterId: VERIFY_ID, username: "DonaldJTrumpJr", displayName: "Donald Trump Jr.", category: "trump_family", trackingTier: "priority", metadata: { role: "WLFI co-founder" } },
  { twitterId: VERIFY_ID, username: "IvankaTrump", displayName: "Ivanka Trump", category: "trump_family", trackingTier: "priority" },
  { twitterId: VERIFY_ID, username: "LaraLeaTrump", displayName: "Lara Trump", category: "trump_family", trackingTier: "priority", metadata: { role: "RNC co-chair" } },
  { twitterId: VERIFY_ID, username: "TiffanyATrump", displayName: "Tiffany Trump", category: "trump_family", trackingTier: "priority" },
  { twitterId: VERIFY_ID, username: "JaredKushner", displayName: "Jared Kushner", category: "trump_family", trackingTier: "priority" },

  // Category 2: World Liberty Financial (PRIORITY)
  { twitterId: VERIFY_ID, username: "worldlibertyfi", displayName: "World Liberty Financial", category: "wlfi", trackingTier: "priority" },
  { twitterId: VERIFY_ID, username: "ZachWitkoff", displayName: "Zach Witkoff", category: "wlfi", trackingTier: "priority", metadata: { role: "WLFI CEO" } },
  { twitterId: VERIFY_ID, username: "ChaseHerro", displayName: "Chase Herro", category: "wlfi", trackingTier: "priority", metadata: { role: "WLFI co-founder" } },
  { twitterId: VERIFY_ID, username: "ZakFolkman", displayName: "Zak Folkman", category: "wlfi", trackingTier: "priority", metadata: { role: "WLFI co-founder" } },

  // Category 3: Key Political Appointees (PRIORITY)
  { twitterId: VERIFY_ID, username: "Kash_Patel", displayName: "Kash Patel", category: "political_appointee", trackingTier: "priority", metadata: { role: "FBI Director" } },
  { twitterId: VERIFY_ID, username: "elonmusk", displayName: "Elon Musk", category: "political_appointee", trackingTier: "priority", metadata: { role: "DOGE head" } },
  { twitterId: VERIFY_ID, username: "PamBondi", displayName: "Pam Bondi", category: "political_appointee", trackingTier: "priority", metadata: { role: "Attorney General" } },
  { twitterId: VERIFY_ID, username: "PeteHegseth", displayName: "Pete Hegseth", category: "political_appointee", trackingTier: "priority", metadata: { role: "Defense Secretary" } },
  { twitterId: VERIFY_ID, username: "RobertKennedyJr", displayName: "Robert F. Kennedy Jr.", category: "political_appointee", trackingTier: "priority", metadata: { role: "HHS Secretary" } },
  { twitterId: VERIFY_ID, username: "TulsiGabbard", displayName: "Tulsi Gabbard", category: "political_appointee", trackingTier: "priority", metadata: { role: "DNI" } },
  { twitterId: VERIFY_ID, username: "SebGorka", displayName: "Sebastian Gorka", category: "political_appointee", trackingTier: "priority", metadata: { role: "Senior Advisor" } },

  // Category 4: White House & Executive Office (STANDARD)
  { twitterId: VERIFY_ID, username: "WhiteHouse", displayName: "The White House", category: "white_house", trackingTier: "standard" },
  { twitterId: VERIFY_ID, username: "POTUS", displayName: "President of the United States", category: "white_house", trackingTier: "standard" },
  { twitterId: VERIFY_ID, username: "VP", displayName: "Vice President", category: "white_house", trackingTier: "standard" },
  { twitterId: VERIFY_ID, username: "PressSec", displayName: "Press Secretary", category: "white_house", trackingTier: "standard" },
  { twitterId: VERIFY_ID, username: "StephenMillerAL", displayName: "Stephen Miller", category: "white_house", trackingTier: "standard", metadata: { role: "Senior Advisor" } },
  { twitterId: VERIFY_ID, username: "SteveWitkoff", displayName: "Steve Witkoff", category: "white_house", trackingTier: "standard", metadata: { role: "Special Envoy" } },

  // Category 5: Federal Agencies (STANDARD)
  { twitterId: VERIFY_ID, username: "FBI", displayName: "FBI", category: "federal_agency", trackingTier: "standard" },
  { twitterId: VERIFY_ID, username: "TheJusticeDept", displayName: "Department of Justice", category: "federal_agency", trackingTier: "standard" },
  { twitterId: VERIFY_ID, username: "SECGov", displayName: "SEC", category: "federal_agency", trackingTier: "standard" },
  { twitterId: VERIFY_ID, username: "USTreasury", displayName: "US Treasury", category: "federal_agency", trackingTier: "standard" },
  { twitterId: VERIFY_ID, username: "StateDept", displayName: "State Department", category: "federal_agency", trackingTier: "standard" },

  // Category 6: Congressional Crypto / Oversight (STANDARD)
  { twitterId: VERIFY_ID, username: "SenWarren", displayName: "Elizabeth Warren", category: "congress", subcategory: "senate", trackingTier: "standard", metadata: { party: "D" } },
  { twitterId: VERIFY_ID, username: "ChrisMurphyCT", displayName: "Chris Murphy", category: "congress", subcategory: "senate", trackingTier: "standard", metadata: { party: "D" } },
  { twitterId: VERIFY_ID, username: "RepRoKhanna", displayName: "Ro Khanna", category: "congress", subcategory: "house", trackingTier: "standard", metadata: { party: "D" } },
  { twitterId: VERIFY_ID, username: "RepMaxineWaters", displayName: "Maxine Waters", category: "congress", subcategory: "house", trackingTier: "standard", metadata: { party: "D" } },
  { twitterId: VERIFY_ID, username: "SenLummis", displayName: "Cynthia Lummis", category: "congress", subcategory: "senate", trackingTier: "standard", metadata: { party: "R" } },
  { twitterId: VERIFY_ID, username: "SenTedCruz", displayName: "Ted Cruz", category: "congress", subcategory: "senate", trackingTier: "standard", metadata: { party: "R" } },
  { twitterId: VERIFY_ID, username: "RepTomEmmer", displayName: "Tom Emmer", category: "congress", subcategory: "house", trackingTier: "standard", metadata: { party: "R" } },
  { twitterId: VERIFY_ID, username: "SenBillHagerty", displayName: "Bill Hagerty", category: "congress", subcategory: "senate", trackingTier: "standard", metadata: { party: "R" } },

  // Category 7: Crypto Industry Connected to Trump (STANDARD)
  { twitterId: VERIFY_ID, username: "justinsuntron", displayName: "Justin Sun", category: "crypto_industry", trackingTier: "standard", metadata: { role: "TRON founder, WLFI investor" } },
  { twitterId: VERIFY_ID, username: "ZachXBT", displayName: "ZachXBT", category: "crypto_industry", trackingTier: "standard", metadata: { role: "Blockchain investigator" } },
];

async function seed() {
  const db = getDb();

  console.log(`Seeding ${PHASE_1_ACCOUNTS.length} Phase 1 accounts...`);

  let seeded = 0;
  let skipped = 0;

  for (const account of PHASE_1_ACCOUNTS) {
    if (account.twitterId === VERIFY_ID) {
      console.log(`  [skip] @${account.username} — needs Twitter ID verification`);
      skipped++;
      continue;
    }

    await db
      .insert(trackedAccounts)
      .values({
        twitterId: account.twitterId,
        username: account.username,
        displayName: account.displayName,
        category: account.category,
        subcategory: account.subcategory ?? null,
        trackingTier: account.trackingTier,
        metadata: account.metadata ?? null,
      })
      .onConflictDoUpdate({
        target: trackedAccounts.twitterId,
        set: {
          username: account.username,
          displayName: account.displayName,
          category: account.category,
          subcategory: account.subcategory ?? null,
          trackingTier: account.trackingTier,
          metadata: account.metadata ?? null,
          updatedAt: new Date(),
        },
      });

    seeded++;
    console.log(`  [ok] @${account.username}`);
  }

  console.log(`\nDone: ${seeded} seeded, ${skipped} skipped (need ID verification)`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
