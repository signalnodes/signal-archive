/**
 * Diagnostic: shows per-account the most recent tweet captured and the gap since then.
 * Run: npx tsx --env-file=.env scripts/check-ingest-gap.ts
 */
import { getDb, trackedAccounts, tweets } from "@taa/db";
import { eq, count, desc } from "drizzle-orm";

async function main() {
  const db = getDb();
  const accounts = await db
    .select({ id: trackedAccounts.id, username: trackedAccounts.username, tier: trackedAccounts.trackingTier })
    .from(trackedAccounts)
    .orderBy(trackedAccounts.trackingTier, trackedAccounts.username);

  const now = new Date();
  const rows: { username: string; tier: string; latest: Date | null; gapDays: number; tweetCount: number }[] = [];

  for (const a of accounts) {
    const [countRes] = await db.select({ n: count() }).from(tweets).where(eq(tweets.accountId, a.id));
    const [latestRow] = await db
      .select({ postedAt: tweets.postedAt })
      .from(tweets)
      .where(eq(tweets.accountId, a.id))
      .orderBy(desc(tweets.postedAt))
      .limit(1);
    const res = { n: countRes?.n ?? 0 };
    const latest = latestRow?.postedAt ? new Date(latestRow.postedAt) : null;
    const gapDays = latest ? Math.floor((now.getTime() - latest.getTime()) / 86_400_000) : 999;
    rows.push({ username: a.username, tier: a.tier, latest, gapDays, tweetCount: Number(res.n) });
  }

  // Sort by gap descending
  rows.sort((a, b) => b.gapDays - a.gapDays);

  console.log("\nIngest gap by account (largest gap first):\n");
  console.log("  " + "Username".padEnd(30) + "Tier".padEnd(12) + "Latest captured".padEnd(24) + "Gap");
  console.log("  " + "─".repeat(78));

  for (const r of rows) {
    const latestStr = r.latest ? r.latest.toISOString().slice(0, 16).replace("T", " ") : "NEVER";
    const gapStr = r.gapDays >= 999 ? "no tweets" : `${r.gapDays}d`;
    console.log(
      "  " +
      `@${r.username}`.padEnd(30) +
      r.tier.padEnd(12) +
      latestStr.padEnd(24) +
      gapStr
    );
  }

  const withData = rows.filter((r) => r.latest !== null);
  if (withData.length > 0) {
    const medianGap = rows[Math.floor(rows.length / 2)]?.gapDays ?? 0;
    const maxGap = rows[0]?.gapDays ?? 0;
    console.log(`\nSummary: ${accounts.length} accounts, gap ranges up to ${maxGap} days (median ~${medianGap}d)`);

    // Find the approximate date ingestion stopped (most recent capture across all accounts)
    const mostRecent = withData.reduce((a, b) => (a.latest! > b.latest! ? a : b));
    console.log(`Last successful capture: ${mostRecent.latest!.toISOString().slice(0, 16)} UTC (@${mostRecent.username})`);
    console.log(`\nTo backfill (free, no API credits):`);
    console.log(`  npx tsx --env-file=.env scripts/gen-accounts-list.ts`);
    const sinceDate = mostRecent.latest!.toISOString().slice(0, 10);
    console.log(`  npx tsx --env-file=.env scripts/browser-ingest.ts --list accounts.txt --since ${sinceDate} --cdp --skip-vpn-check`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
