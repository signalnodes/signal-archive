import { NextRequest, NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { getDb, trackedAccounts, tweets, deletionEvents } from "@taa/db";
import { isSupporter } from "@/lib/supporter-cache";

export async function GET(req: NextRequest) {
  const walletAddress = req.nextUrl.searchParams.get("wallet");
  if (!walletAddress) {
    return NextResponse.json({ error: "Missing wallet param" }, { status: 400 });
  }

  const supported = await isSupporter(walletAddress);
  if (!supported) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [accounts, tweetCounts, deletionCounts] = await Promise.all([
    db
      .select({
        id: trackedAccounts.id,
        username: trackedAccounts.username,
        displayName: trackedAccounts.displayName,
        category: trackedAccounts.category,
        trackingTier: trackedAccounts.trackingTier,
        avatarUrl: trackedAccounts.avatarUrl,
      })
      .from(trackedAccounts)
      .where(
        and(
          eq(trackedAccounts.isActive, true),
          eq(trackedAccounts.donorOnly, true)
        )
      )
      .orderBy(trackedAccounts.category, trackedAccounts.username),
    db
      .select({ accountId: tweets.accountId, count: count() })
      .from(tweets)
      .groupBy(tweets.accountId),
    db
      .select({ accountId: deletionEvents.accountId, count: count() })
      .from(deletionEvents)
      .groupBy(deletionEvents.accountId),
  ]);

  const tweetMap = new Map(tweetCounts.map((t) => [t.accountId, t.count]));
  const deletionMap = new Map(deletionCounts.map((d) => [d.accountId, d.count]));

  const enriched = accounts.map((a) => ({
    ...a,
    tweetCount: tweetMap.get(a.id) ?? 0,
    deletionCount: deletionMap.get(a.id) ?? 0,
  }));

  return NextResponse.json({ accounts: enriched });
}
