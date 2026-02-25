export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb, tweets, trackedAccounts, hcsAttestations, deletionEvents } from "@taa/db";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CategoryBadge } from "@/components/category-badge";
import { Timestamp } from "@/components/timestamp";
import { TweetMetaPanel } from "@/components/tweet-meta-panel";
import { HcsProofPanel } from "@/components/hcs-proof-panel";
import { formatNumber } from "@/lib/format";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const db = getDb();
  const [row] = await db
    .select({ content: tweets.content, username: trackedAccounts.username, isDeleted: tweets.isDeleted })
    .from(tweets)
    .leftJoin(trackedAccounts, eq(tweets.accountId, trackedAccounts.id))
    .where(eq(tweets.id, id))
    .limit(1);
  if (!row) return { title: "Tweet Not Found" };
  const preview = row.content.slice(0, 60);
  return {
    title: `@${row.username ?? "unknown"}: "${preview}…"`,
    description: row.isDeleted
      ? "This tweet was deleted. Cryptographic proof available."
      : "Archived tweet with Hedera Consensus Service attestation.",
  };
}

export default async function TweetDetailPage({ params }: Props) {
  const { id } = await params;
  const db = getDb();

  const [tweetRow] = await db
    .select({
      tweet: tweets,
      account: {
        id: trackedAccounts.id,
        username: trackedAccounts.username,
        displayName: trackedAccounts.displayName,
        category: trackedAccounts.category,
      },
    })
    .from(tweets)
    .leftJoin(trackedAccounts, eq(tweets.accountId, trackedAccounts.id))
    .where(eq(tweets.id, id))
    .limit(1);

  if (!tweetRow) notFound();

  const { tweet, account } = tweetRow;

  const [attestationRows, deletionRows] = await Promise.all([
    db.select().from(hcsAttestations).where(eq(hcsAttestations.tweetId, id)).limit(1),
    tweet.isDeleted
      ? db.select().from(deletionEvents).where(eq(deletionEvents.tweetId, id)).limit(1)
      : Promise.resolve([]),
  ]);

  const attestation = attestationRows[0] ?? null;
  const deletion = deletionRows[0] ?? null;

  const eng = tweet.engagement as {
    likes?: number;
    retweets?: number;
    replies?: number;
    views?: number;
  } | null;

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Account + status line */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {account && (
            <Link
              href={`/accounts/${account.username}`}
              className="font-semibold hover:underline"
            >
              @{account.username}
            </Link>
          )}
          {account && <CategoryBadge category={account.category} />}
          {tweet.isDeleted && <Badge variant="destructive">DELETED</Badge>}
        </div>

        {/* Tweet content */}
        <div className="border rounded-lg p-6 mb-6">
          <p className="text-base leading-relaxed whitespace-pre-wrap break-words">
            {tweet.content}
          </p>
          {tweet.mediaUrls && tweet.mediaUrls.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              [{tweet.mediaUrls.length} media attachment
              {tweet.mediaUrls.length > 1 ? "s" : ""}]
            </p>
          )}
          {eng && (
            <div className="mt-4 pt-4 border-t flex flex-wrap gap-6 text-sm text-muted-foreground">
              <span>♥ {formatNumber(eng.likes)}</span>
              <span>↺ {formatNumber(eng.retweets)}</span>
              <span>💬 {formatNumber(eng.replies)}</span>
              <span>👁 {formatNumber(eng.views)}</span>
            </div>
          )}
          <div className="mt-3">
            <Timestamp date={tweet.postedAt} />
          </div>
        </div>

        {/* Metadata */}
        <TweetMetaPanel tweet={tweet} deletion={deletion} />

        <Separator className="my-6" />

        {/* HCS proof */}
        <HcsProofPanel
          attestation={attestation}
          contentHash={tweet.contentHash}
          tweetId={id}
        />
      </div>
    </div>
  );
}
