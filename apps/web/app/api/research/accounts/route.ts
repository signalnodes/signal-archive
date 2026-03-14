import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
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
  const accounts = await db
    .select({
      id: trackedAccounts.id,
      username: trackedAccounts.username,
      displayName: trackedAccounts.displayName,
      category: trackedAccounts.category,
      trackingTier: trackedAccounts.trackingTier,
      avatarUrl: trackedAccounts.avatarUrl,
      tweetCount: sql<number>`(SELECT COUNT(*) FROM ${tweets} WHERE ${tweets.accountId} = ${trackedAccounts.id})`.as("tweet_count"),
      deletionCount: sql<number>`(SELECT COUNT(*) FROM ${deletionEvents} WHERE ${deletionEvents.accountId} = ${trackedAccounts.id})`.as("deletion_count"),
    })
    .from(trackedAccounts)
    .where(
      and(
        eq(trackedAccounts.isActive, true),
        eq(trackedAccounts.donorOnly, true)
      )
    )
    .orderBy(trackedAccounts.category, trackedAccounts.username);

  return NextResponse.json({ accounts });
}
