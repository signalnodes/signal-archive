export const dynamic = "force-dynamic";

import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { getDb, tweets, deletionEvents, trackedAccounts } from "@taa/db";
import { StatCard } from "@/components/stat-card";
import { RecentDeletionsFeed } from "@/components/recent-deletions-feed";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const db = getDb();

  const [tweetCount, deletionCount, accountCount, recentDeletions] = await Promise.all([
    db.select({ count: count() }).from(tweets),
    db.select({ count: count() }).from(deletionEvents),
    db
      .select({ count: count() })
      .from(trackedAccounts)
      .where(eq(trackedAccounts.isActive, true)),
    db
      .select({
        deletion: {
          id: deletionEvents.id,
          tweetId: deletionEvents.tweetId,
          contentPreview: deletionEvents.contentPreview,
          detectedAt: deletionEvents.detectedAt,
          tweetAgeHours: deletionEvents.tweetAgeHours,
          severityScore: deletionEvents.severityScore,
        },
        account: {
          id: trackedAccounts.id,
          username: trackedAccounts.username,
          displayName: trackedAccounts.displayName,
          category: trackedAccounts.category,
        },
      })
      .from(deletionEvents)
      .leftJoin(trackedAccounts, eq(deletionEvents.accountId, trackedAccounts.id))
      .orderBy(desc(deletionEvents.detectedAt))
      .limit(5),
  ]);

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-12">
      {/* Hero */}
      <section className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl max-w-3xl leading-tight">
          Public statements.
          <br />
          Permanent record.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Signal Archive monitors public figures, captures their statements, and creates
          cryptographic proof anchored to the Hedera Consensus Service. Deletion is never the
          last word.
        </p>
        <div className="mt-6 flex gap-3 flex-wrap">
          <Button asChild>
            <Link href="/deletions">View Deletion Feed</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/accounts">Browse Accounts</Link>
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        <StatCard label="Statements Archived" value={tweetCount[0]?.count ?? 0} href="/search" />
        <StatCard label="Deletions Detected" value={deletionCount[0]?.count ?? 0} href="/deletions" />
        <StatCard label="Accounts Tracked" value={accountCount[0]?.count ?? 0} href="/accounts" />
      </section>

      {/* Recent deletions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Deletions</h2>
          <Link
            href="/deletions"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View all →
          </Link>
        </div>
        <RecentDeletionsFeed deletions={recentDeletions} />
      </section>
    </div>
  );
}
