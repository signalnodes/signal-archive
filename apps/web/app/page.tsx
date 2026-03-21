export const dynamic = "force-dynamic";

import Link from "next/link";
import { and, count, desc, eq } from "drizzle-orm";
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
      .where(and(eq(trackedAccounts.isActive, true), eq(trackedAccounts.donorOnly, false))),
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

  const hasDeletions = (deletionCount[0]?.count ?? 0) > 0;

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-12">
      {/* Hero */}
      <section className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl max-w-3xl leading-tight">
          Deleted.
          <br />
          Documented.
          <br />
          Permanent.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Signal Archive monitors public figures, captures their statements, and creates
          cryptographic proof anchored to the Hedera Consensus Service. Deletion is never the
          last word.
        </p>
        <div className="mt-6 flex gap-3 flex-wrap">
          <Button asChild>
            <Link href="/accounts">Browse Accounts</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/deletions">View Deletion Feed</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/verify">Verify a Tweet</Link>
          </Button>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        <StatCard label="Statements Archived" value={tweetCount[0]?.count ?? 0} href="/search" />
        <StatCard label="Deletions Detected" value={deletionCount[0]?.count ?? 0} href="/deletions" />
        <StatCard label="Accounts Tracked" value={accountCount[0]?.count ?? 0} href="/accounts" />
      </section>

      {/* Recent deletions — or How It Works when feed is empty */}
      {hasDeletions ? (
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
      ) : (
        <section>
          <h2 className="text-xl font-semibold mb-8">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Capture",
                body: "Our worker continuously monitors high-value accounts on X/Twitter. Every new tweet is archived to our database — priority accounts every hour, others every few hours.",
              },
              {
                step: "02",
                title: "Hash & Attest",
                body: "A SHA-256 hash is computed from the tweet's canonical content and submitted to a public Hedera HCS topic. Hedera reaches consensus in seconds. The record is permanent.",
              },
              {
                step: "03",
                title: "Verify",
                body: "Anyone can independently verify any tweet against the HCS record — no trust required. If a tweet is later deleted, the deletion itself is attested on-chain.",
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex flex-col gap-3">
                <span className="text-4xl font-bold font-mono text-primary opacity-80">{step}</span>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6 border-t">
            <p className="text-sm text-muted-foreground">
              Attestations are anchored to{" "}
              <a
                href="https://hashscan.io/mainnet/topic/0.0.10301350"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                HCS topic 0.0.10301350
              </a>{" "}
              on Hedera mainnet — publicly readable by anyone.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
