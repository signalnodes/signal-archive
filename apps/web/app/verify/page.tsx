export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, isNotNull } from "drizzle-orm";
import { getDb, tweets, hcsAttestations, deletionEvents, trackedAccounts } from "@taa/db";
import { VerifyInput } from "@/components/verify-input";
import { SectionOpener } from "@/components/section-opener";

export const metadata: Metadata = {
  title: "Verify a Statement",
  description:
    "Independently verify any archived tweet by checking its SHA-256 content hash against the Hedera Consensus Service.",
  openGraph: {
    title: "Verify a Statement - Signal Archive",
    description:
      "Independently verify any archived tweet by checking its SHA-256 content hash against the Hedera Consensus Service.",
  },
};

export default async function VerifyPage() {
  const db = getDb();
  const [featured] = await db
    .select({
      contentHash: tweets.contentHash,
      contentPreview: deletionEvents.contentPreview,
      detectedAt: deletionEvents.detectedAt,
      username: trackedAccounts.username,
      displayName: trackedAccounts.displayName,
    })
    .from(deletionEvents)
    .innerJoin(tweets, eq(deletionEvents.tweetId, tweets.id))
    .innerJoin(trackedAccounts, eq(deletionEvents.accountId, trackedAccounts.id))
    .innerJoin(hcsAttestations, eq(hcsAttestations.tweetId, tweets.id))
    .where(isNotNull(tweets.contentHash))
    .orderBy(desc(deletionEvents.severityScore))
    .limit(1);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <SectionOpener
        eyebrow="Proof Verification"
        title="Verify a Statement"
        description="Enter any SHA-256 content hash from our archive. If it matches an attested record, you'll see the full cryptographic proof — independently verifiable on Hedera, no login or trust required."
      />

      <VerifyInput />

      {featured?.contentHash && (
        <Link
          href={`/verify/${featured.contentHash}`}
          className="group mt-5 flex flex-col gap-2 rounded-lg border border-border bg-muted/20 px-4 py-3 hover:border-border/80 hover:bg-muted/30 transition-colors"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 leading-none">
            Featured record
          </p>
          <p className="text-sm font-medium text-foreground">
            @{featured.username}
            {featured.detectedAt && (
              <span className="font-normal text-muted-foreground">
                {" "}· Deleted{" "}
                {new Date(featured.detectedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </p>
          {featured.contentPreview && (
            <p className="text-sm text-muted-foreground font-editorial leading-snug line-clamp-2">
              &ldquo;{featured.contentPreview}&rdquo;
            </p>
          )}
          <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
            Verify this record →
          </p>
        </Link>
      )}

      <div className="mt-12 border-t pt-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 mb-5 leading-none">
          How verification works
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "Get the hash",
              body: "Every archived tweet has a SHA-256 fingerprint on its proof page. Copy that hash.",
            },
            {
              step: "02",
              title: "Submit here",
              body: "Paste the hash above. We check the archive and the HCS attestation record.",
            },
            {
              step: "03",
              title: "Proof returned",
              body: "If matched, you see the full record: content, consensus timestamp, sequence number, and HCS explorer link.",
            },
          ].map(({ step, title, body }) => (
            <div key={step} className="flex flex-col gap-2">
              <span className="text-2xl font-bold font-mono text-primary opacity-70">{step}</span>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
