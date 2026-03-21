export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb, tweets, trackedAccounts, hcsAttestations } from "@taa/db";
import { VerifyInput } from "@/components/verify-input";
import { VerifyResult } from "@/components/verify-result";

export const metadata: Metadata = {
  title: "Verify Hash",
  description:
    "Verification result for a SHA-256 content hash against Signal Archive's Hedera HCS attestations.",
};

interface Props {
  params: Promise<{ hash: string }>;
}

export default async function VerifyHashPage({ params }: Props) {
  const { hash: rawHash } = await params;
  const hash = rawHash.toLowerCase();
  const db = getDb();

  const [tweetRow] = await db
    .select({
      tweet: {
        id: tweets.id,
        content: tweets.content,
        postedAt: tweets.postedAt,
        isDeleted: tweets.isDeleted,
      },
      account: {
        username: trackedAccounts.username,
      },
    })
    .from(tweets)
    .leftJoin(trackedAccounts, eq(tweets.accountId, trackedAccounts.id))
    .where(eq(tweets.contentHash, hash))
    .limit(1);

  const attestation = tweetRow
    ? await db
        .select({
          transactionId: hcsAttestations.transactionId,
          topicId: hcsAttestations.topicId,
          sequenceNumber: hcsAttestations.sequenceNumber,
          consensusTimestamp: hcsAttestations.consensusTimestamp,
        })
        .from(hcsAttestations)
        .where(eq(hcsAttestations.tweetId, tweetRow.tweet.id))
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">Verify Content Hash</h1>
      <p className="text-muted-foreground mb-8">
        Enter a SHA-256 content hash to check if a matching tweet is in the archive with a
        valid Hedera attestation.
      </p>
      <VerifyInput defaultHash={hash} />
      <div className="mt-8">
        <VerifyResult
          hash={hash}
          tweet={tweetRow?.tweet ?? null}
          account={tweetRow?.account ?? null}
          attestation={attestation}
        />
      </div>
    </div>
  );
}
