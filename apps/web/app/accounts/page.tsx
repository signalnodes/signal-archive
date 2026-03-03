export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { count, eq } from "drizzle-orm";
import { getDb, trackedAccounts, tweets, deletionEvents } from "@taa/db";
import { AccountsGrid } from "@/components/accounts-grid";

export const metadata: Metadata = { title: "Tracked Accounts" };

export default async function AccountsPage() {
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
      .where(eq(trackedAccounts.isActive, true))
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

  const categoryCount = new Set(accounts.map((a) => a.category)).size;

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Tracked Accounts</h1>
      <p className="text-muted-foreground mb-6">
        {accounts.length} active accounts across {categoryCount} categories
      </p>
      <AccountsGrid accounts={enriched} />
    </div>
  );
}
