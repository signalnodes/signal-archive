export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { count, desc, eq } from "drizzle-orm";
import { getDb, trackedAccounts, tweets, deletionEvents } from "@taa/db";
import { AccountHeader } from "@/components/account-header";
import { AccountTabs } from "@/components/account-tabs";
import type { DeletionRow } from "@/components/recent-deletions-feed";

const PAGE_SIZE = 25;

interface Props {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string }>;
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
  const title = `@${username}`;
  const description = `${displayName}'s archived tweets and detected deletions — cryptographically attested on Signal Archive.`;

  return {
    title,
    description,
    openGraph: {
      title: `@${username} — Signal Archive`,
      description,
      url: `https://signalarchive.org/accounts/${username}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `@${username} — Signal Archive`,
      description,
    },
  };
}

export default async function AccountProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const db = getDb();

  const [accountRow] = await db
    .select()
    .from(trackedAccounts)
    .where(eq(trackedAccounts.username, username))
    .limit(1);

  if (!accountRow) notFound();

  const [tweetList, deletionList, tweetCountResult, deletionCountResult] = await Promise.all([
    db
      .select({
        id: tweets.id,
        tweetId: tweets.tweetId,
        content: tweets.content,
        tweetType: tweets.tweetType,
        isDeleted: tweets.isDeleted,
        postedAt: tweets.postedAt,
        engagement: tweets.engagement,
        mediaUrls: tweets.mediaUrls,
      })
      .from(tweets)
      .where(eq(tweets.accountId, accountRow.id))
      .orderBy(desc(tweets.postedAt))
      .limit(PAGE_SIZE)
      .offset(offset),
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
      .where(eq(deletionEvents.accountId, accountRow.id))
      .orderBy(desc(deletionEvents.detectedAt))
      .limit(20),
    db.select({ count: count() }).from(tweets).where(eq(tweets.accountId, accountRow.id)),
    db
      .select({ count: count() })
      .from(deletionEvents)
      .where(eq(deletionEvents.accountId, accountRow.id)),
  ]);

  const totalTweets = tweetCountResult[0]?.count ?? 0;
  const totalDeletions = deletionCountResult[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalTweets / PAGE_SIZE));

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <AccountHeader
        account={accountRow}
        stats={{ totalTweets, totalDeletions }}
      />
      <AccountTabs
        tweets={tweetList}
        deletions={deletionList as DeletionRow[]}
        totalTweets={totalTweets}
        totalDeletions={totalDeletions}
        username={accountRow.username}
        currentPage={currentPage}
        totalPages={totalPages}
      />
    </div>
  );
}
