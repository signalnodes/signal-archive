/**
 * Seed tracked accounts for Phase 1.
 *
 * Twitter IDs sourced from public lookup tools.
 * Accounts with unknown IDs use deterministic placeholders (prefixed "0")
 * and should be verified before production use.
 *
 * Usage: npm run db:seed
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

const PHASE_1_ACCOUNTS: SeedAccount[] = [
  // Category 1: Trump Family & Inner Circle (PRIORITY)
  { twitterId: "25073877", username: "realDonaldTrump", displayName: "Donald Trump", category: "trump_family", trackingTier: "priority", metadata: { role: "President, WLFI co-founder emeritus" } },
  { twitterId: "468456834", username: "MELANIATRUMP", displayName: "Melania Trump", category: "trump_family", trackingTier: "priority", metadata: { role: "First Lady, $MELANIA meme coin" } },
  { twitterId: "39349894", username: "EricTrump", displayName: "Eric Trump", category: "trump_family", trackingTier: "priority", metadata: { role: "WLFI co-founder" } },
  { twitterId: "39344374", username: "DonaldJTrumpJr", displayName: "Donald Trump Jr.", category: "trump_family", trackingTier: "priority", metadata: { role: "WLFI co-founder" } },
  { twitterId: "52544275", username: "IvankaTrump", displayName: "Ivanka Trump", category: "trump_family", trackingTier: "priority" },
  { twitterId: "0100000006", username: "LaraLeaTrump", displayName: "Lara Trump", category: "trump_family", trackingTier: "priority", metadata: { role: "RNC co-chair" } },
  { twitterId: "0100000007", username: "TiffanyATrump", displayName: "Tiffany Trump", category: "trump_family", trackingTier: "priority" },
  { twitterId: "0100000008", username: "JaredKushner", displayName: "Jared Kushner", category: "trump_family", trackingTier: "priority" },

  // Category 2: World Liberty Financial (PRIORITY)
  { twitterId: "0200000001", username: "worldlibertyfi", displayName: "World Liberty Financial", category: "wlfi", trackingTier: "priority" },
  { twitterId: "0200000002", username: "ZachWitkoff", displayName: "Zach Witkoff", category: "wlfi", trackingTier: "priority", metadata: { role: "WLFI CEO" } },
  { twitterId: "0200000003", username: "ChaseHerro", displayName: "Chase Herro", category: "wlfi", trackingTier: "priority", metadata: { role: "WLFI co-founder" } },
  { twitterId: "0200000004", username: "ZakFolkman", displayName: "Zak Folkman", category: "wlfi", trackingTier: "priority", metadata: { role: "WLFI co-founder" } },

  // Category 3: Key Political Appointees (PRIORITY)
  { twitterId: "0300000001", username: "Kash_Patel", displayName: "Kash Patel", category: "political_appointee", trackingTier: "priority", metadata: { role: "FBI Director" } },
  { twitterId: "44196397", username: "elonmusk", displayName: "Elon Musk", category: "political_appointee", trackingTier: "priority", metadata: { role: "DOGE head" } },
  { twitterId: "0300000003", username: "PamBondi", displayName: "Pam Bondi", category: "political_appointee", trackingTier: "priority", metadata: { role: "Attorney General (personal account)" } },
  { twitterId: "0300000009", username: "AGPamBondi", displayName: "AG Pam Bondi", category: "political_appointee", trackingTier: "priority", metadata: { role: "Attorney General (official account)" } },
  { twitterId: "61633009", username: "PeteHegseth", displayName: "Pete Hegseth", category: "political_appointee", trackingTier: "priority", metadata: { role: "Defense Secretary" } },
  { twitterId: "0300000005", username: "RobertKennedyJr", displayName: "Robert F. Kennedy Jr.", category: "political_appointee", trackingTier: "priority", metadata: { role: "HHS Secretary" } },
  { twitterId: "26637348", username: "TulsiGabbard", displayName: "Tulsi Gabbard", category: "political_appointee", trackingTier: "priority", metadata: { role: "DNI" } },
  { twitterId: "0300000007", username: "SebGorka", displayName: "Sebastian Gorka", category: "political_appointee", trackingTier: "priority", metadata: { role: "Senior Advisor" } },

  // Category 4: White House & Executive Office (STANDARD)
  { twitterId: "822215679726100480", username: "WhiteHouse", displayName: "The White House", category: "white_house", trackingTier: "standard" },
  { twitterId: "1349149096909668363", username: "POTUS", displayName: "President of the United States", category: "white_house", trackingTier: "standard" },
  { twitterId: "1346524486936080386", username: "VP", displayName: "Vice President", category: "white_house", trackingTier: "standard" },
  { twitterId: "2336787612", username: "JDVance", displayName: "JD Vance", category: "white_house", trackingTier: "priority", metadata: { role: "Vice President (personal account)" } },
  { twitterId: "0400000004", username: "PressSec", displayName: "Press Secretary", category: "white_house", trackingTier: "standard" },
  { twitterId: "0400000005", username: "StephenMillerAL", displayName: "Stephen Miller", category: "white_house", trackingTier: "standard", metadata: { role: "Senior Advisor" } },
  { twitterId: "0400000006", username: "SteveWitkoff", displayName: "Steve Witkoff", category: "white_house", trackingTier: "standard", metadata: { role: "Special Envoy" } },

  // Category 5: Federal Agencies (STANDARD)
  { twitterId: "742143", username: "FBI", displayName: "FBI", category: "federal_agency", trackingTier: "standard" },
  { twitterId: "0500000002", username: "TheJusticeDept", displayName: "Department of Justice", category: "federal_agency", trackingTier: "standard" },
  { twitterId: "0500000003", username: "SECGov", displayName: "SEC", category: "federal_agency", trackingTier: "standard" },
  { twitterId: "0500000004", username: "USTreasury", displayName: "US Treasury", category: "federal_agency", trackingTier: "standard" },
  { twitterId: "0500000005", username: "StateDept", displayName: "State Department", category: "federal_agency", trackingTier: "standard" },

  // Category 6: Congressional Crypto / Oversight (STANDARD)
  { twitterId: "970207298", username: "SenWarren", displayName: "Elizabeth Warren", category: "congress", subcategory: "senate", trackingTier: "standard", metadata: { party: "D" } },
  { twitterId: "150078976", username: "ChrisMurphyCT", displayName: "Chris Murphy", category: "congress", subcategory: "senate", trackingTier: "standard", metadata: { party: "D" } },
  { twitterId: "19448251", username: "RepRoKhanna", displayName: "Ro Khanna", category: "congress", subcategory: "house", trackingTier: "standard", metadata: { party: "D" } },
  { twitterId: "25943661", username: "RepMaxineWaters", displayName: "Maxine Waters", category: "congress", subcategory: "house", trackingTier: "standard", metadata: { party: "D" } },
  { twitterId: "0600000005", username: "SenLummis", displayName: "Cynthia Lummis", category: "congress", subcategory: "senate", trackingTier: "standard", metadata: { party: "R" } },
  { twitterId: "30354991", username: "SenTedCruz", displayName: "Ted Cruz", category: "congress", subcategory: "senate", trackingTier: "standard", metadata: { party: "R" } },
  { twitterId: "0600000007", username: "GOPMajorityWhip", displayName: "Tom Emmer", category: "congress", subcategory: "house", trackingTier: "standard", metadata: { party: "R", role: "House Majority Whip" } },
  { twitterId: "0600000008", username: "SenBillHagerty", displayName: "Bill Hagerty", category: "congress", subcategory: "senate", trackingTier: "standard", metadata: { party: "R" } },

  // Category 7: Crypto Industry Connected to Trump (STANDARD)
  { twitterId: "911017811666030592", username: "justinsuntron", displayName: "Justin Sun", category: "crypto_industry", trackingTier: "standard", metadata: { role: "TRON founder, WLFI investor" } },
  { twitterId: "1347660844856152069", username: "ZachXBT", displayName: "ZachXBT", category: "crypto_industry", trackingTier: "standard", metadata: { role: "Blockchain investigator" } },
];

async function seed() {
  const db = getDb();

  console.log(`Seeding ${PHASE_1_ACCOUNTS.length} Phase 1 accounts...`);

  let seeded = 0;

  for (const account of PHASE_1_ACCOUNTS) {
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
    console.log(`  [ok] @${account.username} (${account.twitterId})`);
  }

  console.log(`\nDone: ${seeded} accounts seeded`);
  console.log(
    "NOTE: IDs starting with '0' are placeholders — verify before production use"
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
