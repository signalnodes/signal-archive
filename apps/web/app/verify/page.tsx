export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { eq, isNotNull } from "drizzle-orm";
import { getDb, tweets, hcsAttestations } from "@taa/db";
import { VerifyInput } from "@/components/verify-input";

export const metadata: Metadata = {
  title: "Verify Hash",
  description:
    "Independently verify any archived tweet by checking its SHA-256 content hash against the Hedera Consensus Service.",
  openGraph: {
    title: "Verify Hash - Signal Archive",
    description:
      "Independently verify any archived tweet by checking its SHA-256 content hash against the Hedera Consensus Service.",
  },
};

export default async function VerifyPage() {
  const db = getDb();
  const [example] = await db
    .select({ contentHash: tweets.contentHash, tweetId: tweets.id })
    .from(tweets)
    .innerJoin(hcsAttestations, eq(hcsAttestations.tweetId, tweets.id))
    .where(isNotNull(tweets.contentHash))
    .limit(1);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">Verify Content Hash</h1>
      <p className="text-muted-foreground mb-8">
        Enter a SHA-256 content hash to check if a matching tweet is in the archive with a
        valid Hedera attestation.
      </p>
      <VerifyInput />
      {example?.contentHash && (
        <p className="mt-3 text-sm text-muted-foreground">
          Don&apos;t have a hash?{" "}
          <Link
            href={`/verify/${example.contentHash}`}
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Try a real example →
          </Link>
        </p>
      )}
    </div>
  );
}
