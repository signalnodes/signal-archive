import type { Metadata } from "next";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "About",
  description:
    "How Signal Archive works — continuous monitoring, cryptographic attestation, and independent verification via the Hedera Consensus Service.",
  openGraph: {
    title: "About — Signal Archive",
    description:
      "How Signal Archive works — continuous monitoring, cryptographic attestation, and independent verification via the Hedera Consensus Service.",
  },
};

export default function AboutPage() {
  return (
    <div className="container mx-auto max-w-screen-md px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-3">About Signal Archive</h1>
      <p className="text-lg text-muted-foreground leading-relaxed mb-10">
        Public figures delete tweets. We make sure that deletion is never the last word.
      </p>

      <Separator className="mb-10" />

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">What this is</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Signal Archive continuously monitors the public statements of politicians, government
          officials, and figures of public interest. Every tweet we capture is cryptographically
          hashed and that hash is anchored to the{" "}
          <a
            href="https://hedera.com/consensus-service"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Hedera Consensus Service
          </a>{" "}
          — a public, immutable ledger operated by a global network of independent nodes.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          When a tweet is deleted, we detect it, record it, and file a second attestation. The
          result is a tamper-proof timeline: what was said, when it was said, and when it
          disappeared.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">How it works</h2>
        <ol className="space-y-5">
          {[
            {
              step: "1. Continuous monitoring",
              detail:
                "We poll tracked accounts at regular intervals — every few minutes for high-priority accounts, every 15–60 minutes for others. Each poll captures the full tweet text, metadata, and engagement counts at time of capture.",
            },
            {
              step: "2. Cryptographic hashing",
              detail:
                "Each captured tweet is serialized into a canonical JSON format (deterministic key ordering, fixed fields) and hashed with SHA-256. This hash is a fingerprint: any change to the tweet content produces a completely different hash.",
            },
            {
              step: "3. Hedera attestation",
              detail:
                "The hash — along with the tweet ID, author ID, and timestamps — is submitted as a message to a Hedera Consensus Service topic. Hedera assigns a consensus timestamp and sequence number. This record is permanent and cannot be altered or deleted by anyone, including us.",
            },
            {
              step: "4. Deletion detection",
              detail:
                "We continuously check whether archived tweets still exist. When a tweet returns a 404, we flag it as deleted, record the deletion event, and submit a second HCS message referencing the original attestation.",
            },
          ].map(({ step, detail }) => (
            <li key={step} className="flex gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm mb-1">{step}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">How to verify a tweet yourself</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          You don&apos;t have to trust us. Every attestation is independently verifiable:
        </p>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="leading-relaxed">
            <span className="font-mono text-foreground">1.</span> Find the tweet in our archive and
            copy its content hash (SHA-256).
          </li>
          <li className="leading-relaxed">
            <span className="font-mono text-foreground">2.</span> Look up the HCS message on the{" "}
            <a
              href="https://hashscan.io"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Hedera Mirror Node (HashScan)
            </a>{" "}
            using the topic ID and sequence number shown on the tweet&apos;s proof page.
          </li>
          <li className="leading-relaxed">
            <span className="font-mono text-foreground">3.</span> Compare the hash in the HCS
            message with the hash you computed from the tweet data. If they match, the content is
            proven authentic and unaltered since the consensus timestamp.
          </li>
        </ol>
        <div className="mt-4">
          <Link
            href="/verify"
            className="text-sm underline underline-offset-2 hover:text-foreground text-muted-foreground"
          >
            Use our verification tool →
          </Link>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">Why Hedera</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          Hedera Consensus Service was chosen for three reasons:
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground font-medium">Independent governance.</span> Hedera is
            governed by a council of global enterprises — no single company controls the ledger.
          </li>
          <li>
            <span className="text-foreground font-medium">Immutability.</span> Messages submitted to
            HCS cannot be altered or deleted by anyone, including the topic creator.
          </li>
          <li>
            <span className="text-foreground font-medium">Cost.</span> Each attestation costs
            approximately $0.0001 — making large-scale archival economically viable.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">Methodology & scope</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          Phase 1 tracks approximately 40 accounts: Trump family members, affiliated crypto project
          accounts, key political appointees, and select members of Congress. Retweets are excluded
          — we track what people say, not what they amplify.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Accounts are selected based on public interest, history of deletion, and relevance to
          active legal or political accountability questions.
        </p>
      </section>

      <Separator className="mb-10" />

      <section>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Signal Archive monitors publicly visible statements made by public figures in their public
          capacity. All archived content was publicly accessible at time of capture. This project
          operates in the public interest under established principles of press freedom and public
          records accountability.
        </p>
      </section>
    </div>
  );
}
