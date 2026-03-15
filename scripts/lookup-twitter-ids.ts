/**
 * Looks up real Twitter IDs for placeholder accounts via SocialData API.
 * Usage: npx tsx scripts/lookup-twitter-ids.ts
 */

import * as fs from "fs";

const SOCIALDATA_API_KEY = process.env.SOCIALDATA_API_KEY;
if (!SOCIALDATA_API_KEY) {
  console.error("SOCIALDATA_API_KEY is required");
  process.exit(1);
}

// Known IDs (high confidence — stable government/public accounts)
export const KNOWN_IDS: Record<string, string> = {
  TheJusticeDept:  "99258859",
  SECGov:          "18479955",
  USTreasury:      "27228153",
  StateDept:       "26566375",
  StephenMillerAL: "371784440",
  justinsuntron:   "911017811666030592",
  JDVance:         "2336787612",
  AGPamBondi:      "1886531809284173824",
  GOPMajorityWhip: "2914515430",
};

// Still need lookup (placeholder twitterIds in DB — resolve when SocialData key available)
const PLACEHOLDER_ACCOUNTS = [
  "LaraLeaTrump",
  "TiffanyATrump",
  "JaredKushner",
  "worldlibertyfi",
  "ZachWitkoff",
  "ChaseHerro",
  "ZakFolkman",
  "Kash_Patel",
  "PamBondi",
  "RobertKennedyJr",
  "SebGorka",
  "PressSec",
  "SteveWitkoff",
  "SenLummis",
  "SenBillHagerty",
];

async function lookupUser(username: string): Promise<{ id: string; name: string } | null> {
  // Use search (from:username) to get a tweet — the author ID is embedded in the response
  const url = `https://api.socialdata.tools/twitter/search?query=${encodeURIComponent(`from:${username}`)}&type=Latest`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SOCIALDATA_API_KEY}` },
  });

  if (!res.ok) {
    console.warn(`  [fail] @${username} — HTTP ${res.status}`);
    return null;
  }

  const data = await res.json();
  const tweets: Array<{ user: { id_str: string; name: string } }> = data.tweets ?? [];

  if (tweets.length === 0) {
    console.warn(`  [fail] @${username} — no tweets found`);
    return null;
  }

  const user = tweets[0].user;
  return { id: user.id_str, name: user.name };
}

async function main() {
  console.log(`Looking up ${PLACEHOLDER_ACCOUNTS.length} accounts via SocialData...\n`);

  const results: Record<string, string> = {};

  for (const username of PLACEHOLDER_ACCOUNTS) {
    // Small delay to respect rate limits
    await new Promise((r) => setTimeout(r, 500));
    const user = await lookupUser(username);
    if (user) {
      console.log(`  [ok] @${username} → ${user.id} (${user.name})`);
      results[username] = user.id;
    }
  }

  console.log("\n--- Results (copy into seed-accounts.ts or update script) ---\n");
  for (const [username, id] of Object.entries(results)) {
    console.log(`@${username}: ${id}`);
  }

  fs.writeFileSync(
    "scripts/lookup-results.json",
    JSON.stringify(results, null, 2)
  );
  console.log("\nSaved to scripts/lookup-results.json");

  process.exit(0);
}

main().catch((err) => {
  console.error("Lookup failed:", err);
  process.exit(1);
});
