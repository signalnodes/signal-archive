export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { and, count, eq } from "drizzle-orm";
import { getDb, trackedAccounts, tweets, deletionEvents } from "@taa/db";
import { AccountsGrid } from "@/components/accounts-grid";
import { SectionOpener } from "@/components/section-opener";

export async function generateMetadata(): Promise<Metadata> {
  const db = getDb();
  const [result] = await db
    .select({ count: count() })
    .from(trackedAccounts)
    .where(and(eq(trackedAccounts.isActive, true), eq(trackedAccounts.donorOnly, false)));
  const n = result?.count ?? 0;
  const desc = `${n} politicians and public figures monitored by Signal Archive. Every tweet archived and attested on Hedera.`;
  return {
    title: "Tracked Accounts",
    description: desc,
    openGraph: {
      title: "Tracked Accounts - Signal Archive",
      description: desc,
    },
  };
}

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
      .where(and(eq(trackedAccounts.isActive, true), eq(trackedAccounts.donorOnly, false)))
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
      <SectionOpener
        eyebrow="Archive Scope"
        title="Tracked Accounts"
        description={`${accounts.length} active accounts across ${categoryCount} categories, continuously monitored. Every statement archived and attested.`}
      />
      <AccountsGrid accounts={enriched} />
    </div>
  );
}
