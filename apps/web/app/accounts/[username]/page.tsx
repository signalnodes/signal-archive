export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { count, desc, eq } from "drizzle-orm";
import { getDb, trackedAccounts, tweets, deletionEvents, hcsAttestations } from "@taa/db";
import { AccountHeader } from "@/components/account-header";
import { ReceiptCard } from "@/components/receipt-card";
import { AccountSegmentedControl } from "@/components/account-segmented-control";
import { toAccountUI } from "@/lib/adapters/account";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const db = getDb();
  const [account] = await db
    .select({ displayName: trackedAccounts.displayName })
    .from(trackedAccounts)
    .where(eq(trackedAccounts.username, username))
    .limit(1);

  const displayName = account?.displayName ?? `@${username}`;
  const description = `${displayName}'s archived tweets and detected deletions, cryptographically attested on Signal Archive.`;

  return {
    title: `@${username}`,
    description,
    openGraph: {
      title: `@${username} - Signal Archive`,
      description,
      url: `https://signalarchive.org/accounts/${username}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `@${username} - Signal Archive`,
      description,
    },
  };
}

export default async function AccountProfilePage({ params }: Props) {
  const { username } = await params;
  const db = getDb();

  const [accountRow] = await db
    .select()
    .from(trackedAccounts)
    .where(eq(trackedAccounts.username, username))
    .limit(1);

  if (!accountRow) notFound();

  const meta = accountRow.metadata as Record<string, unknown> | null;
  const trackingMode = (meta?.trackingMode as "FULL_ARCHIVE" | "IDENTITY_ONLY") ?? "FULL_ARCHIVE";
  const isFullArchive = trackingMode === "FULL_ARCHIVE";

  // Fetch counts and latest attestation server-side for the header + receipt card.
  // IDENTITY_ONLY accounts skip tweet/deletion count queries entirely.
  // Cost note: all three are indexed on account_id — cheap per-request.
  const [tweetCountResult, deletionCountResult, latestAttestation] = await Promise.all([
    isFullArchive
      ? db.select({ count: count() }).from(tweets).where(eq(tweets.accountId, accountRow.id))
      : Promise.resolve([{ count: 0 }]),
    isFullArchive
      ? db.select({ count: count() }).from(deletionEvents).where(eq(deletionEvents.accountId, accountRow.id))
      : Promise.resolve([{ count: 0 }]),
    db
      .select({ tweetId: hcsAttestations.tweetId })
      .from(hcsAttestations)
      .innerJoin(tweets, eq(hcsAttestations.tweetId, tweets.id))
      .where(eq(tweets.accountId, accountRow.id))
      .orderBy(desc(hcsAttestations.consensusTimestamp))
      .limit(1),
  ]);

  const totalTweets = tweetCountResult[0]?.count ?? 0;
  const totalDeletions = deletionCountResult[0]?.count ?? 0;

  const accountUI = toAccountUI(accountRow, {
    tweetCount: totalTweets,
    deletionCount: totalDeletions,
  });

  const latestProofUrl = latestAttestation[0]?.tweetId
    ? `/tweet/${latestAttestation[0].tweetId}`
    : undefined;

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <AccountHeader
          account={accountRow}
          stats={isFullArchive ? { totalTweets, totalDeletions } : undefined}
          trackingMode={trackingMode}
        />
        <ReceiptCard account={accountUI} latestProofUrl={latestProofUrl} />
        <AccountSegmentedControl account={accountUI} />
      </div>
    </div>
  );
}
