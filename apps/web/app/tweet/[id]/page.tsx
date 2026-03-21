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
import { MediaAttachment } from "@/components/media-attachment";

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
  const username = row.username ?? "unknown";
  const preview = row.content.slice(0, 120);
  const title = `@${username}: "${preview}${row.content.length > 120 ? "…" : ""}"`;
  const description = row.isDeleted
    ? `@${username} deleted this tweet. Cryptographic proof of its existence is anchored to the Hedera Consensus Service.`
    : `Archived tweet from @${username} with Hedera Consensus Service attestation.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://signalarchive.org/tweet/${id}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
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

  const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? process.env.HEDERA_NETWORK ?? "mainnet";
  const isTestnet = network === "testnet";

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        {account && (
          <Link
            href={`/accounts/${account.username}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 inline-block"
          >
            ← @{account.username}
          </Link>
        )}

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
          {isTestnet && (
            <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/40">
              TESTNET
            </Badge>
          )}
        </div>

        {/* Tweet content */}
        <div className="border rounded-lg p-6 mb-6">
          <p className="text-base leading-relaxed whitespace-pre-wrap break-words">
            {tweet.content}
          </p>
          {tweet.mediaUrls && tweet.mediaUrls.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {tweet.mediaUrls.map((url, i) => (
                <MediaAttachment key={i} url={url} index={i} />
              ))}
              {tweet.isDeleted && (
                <p className="text-xs text-muted-foreground/50 italic">
                  Media URLs recorded at capture time — may become unavailable if CDN purges.
                </p>
              )}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between">
            <Timestamp date={tweet.postedAt} />
            {tweet.isDeleted ? (
              <span className="text-xs text-muted-foreground">
                Removed from X
                {deletion?.detectedAt && (
                  <> · <Timestamp date={new Date(deletion.detectedAt)} /></>
                )}
              </span>
            ) : account && (
              <Link
                href={`https://x.com/${account.username}/status/${tweet.tweetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View on X ↗
              </Link>
            )}
          </div>
        </div>

        {/* Metadata */}
        <TweetMetaPanel tweet={tweet} deletion={deletion ? { ...deletion, metadata: deletion.metadata as { ai?: { reasoning?: string; confidence?: number; model?: string } } | null } : null} />

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
