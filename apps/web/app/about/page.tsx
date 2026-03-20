import type { Metadata } from "next";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { IconHeart } from "@tabler/icons-react";

export const metadata: Metadata = {
  title: "About",
  description:
    "How Signal Archive works: continuous monitoring, cryptographic attestation, and independent verification via the Hedera Consensus Service.",
  openGraph: {
    title: "About - Signal Archive",
    description:
      "How Signal Archive works: continuous monitoring, cryptographic attestation, and independent verification via the Hedera Consensus Service.",
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
          </a>
          , a public, immutable ledger operated by a global network of independent nodes.
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
                "We poll tracked accounts at regular intervals: every hour for high-priority accounts, every four hours for others. Each poll captures the full tweet text and metadata at time of capture.",
            },
            {
              step: "2. Cryptographic hashing",
              detail:
                "Each captured tweet is serialized into a canonical JSON format (deterministic key ordering, fixed fields) and hashed with SHA-256. This hash is a fingerprint: any change to the tweet content produces a completely different hash.",
            },
            {
              step: "3. Hedera attestation",
              detail:
                "The hash, along with the tweet ID, author ID, and timestamps, is submitted as a message to a Hedera Consensus Service topic. Hedera assigns a consensus timestamp and sequence number. This record is permanent and cannot be altered or deleted by anyone, including us.",
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
          Hedera Consensus Service was chosen because it answers the hardest question about an
          archive like this: <em>what stops you from altering or suppressing the records?</em>
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          The answer: nothing we do after submission matters. HCS is a public, append-only ledger
          with no delete operation. Once a message is submitted, it is permanently visible to anyone
          on the public network — including the sequence number, timestamp, and content. Even if
          Signal Archive were shut down tomorrow, every attestation would remain readable on Hedera
          indefinitely. We cannot alter, retract, or suppress them.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground font-medium">Independent governance.</span> Hedera is
            governed by a council of global enterprises, with no single company controlling the ledger.
          </li>
          <li>
            <span className="text-foreground font-medium">Immutability.</span> Messages submitted to
            HCS cannot be altered or deleted by anyone, including the topic creator.
          </li>
          <li>
            <span className="text-foreground font-medium">Cost.</span> Each attestation costs
            approximately $0.0008, making large-scale archival economically viable.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">Methodology & scope</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          Phase 1 tracks approximately 40 accounts: Trump family members, affiliated crypto project
          accounts (World Liberty Financial, $TRUMP, $MELANIA), key political appointees, and select
          federal officials. Retweets are excluded; we track what people say, not what they amplify.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          <span className="text-foreground font-medium">Why these accounts?</span> Phase 1 is
          deliberately focused on the executive branch and crypto-adjacent public officials because
          that intersection — government power plus financial self-interest in digital assets — is
          where public accountability is most urgent and deletion patterns are most documented. This
          is a starting scope, not a complete picture. Phase 2 will expand to all 535 members of
          Congress. Accounts are added based on public interest, documented deletion history, and
          relevance to active legal or political accountability questions — not based on party.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          <span className="text-foreground font-medium">Deletion severity.</span> Each detected
          deletion receives a severity score (1–10) generated by Claude 3.5 Haiku, Anthropic&apos;s
          fast AI model. The score reflects estimated public interest significance based on content,
          tweet age, and the account&apos;s role. Scores are indicative, not definitive — they help
          surface potentially newsworthy deletions but carry the limitations of any automated
          classification. Low-confidence scores are not suppressed; treat them as a starting signal,
          not a verdict.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          All source code and scoring logic is available for review. The HCS topic is fully public;
          anyone can audit the complete record of submissions independently.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">Coverage & limitations</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          No archive is perfect. Here is what Signal Archive does and does not capture:
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground font-medium">Monitoring start date.</span> Archiving
            began in January 2025. Tweets posted before that date are not in the archive.
          </li>
          <li>
            <span className="text-foreground font-medium">Fast deletions.</span> Ingestion runs
            every hour for priority accounts, every four hours for others. A tweet deleted
            shortly after posting may not be captured before it disappears.
          </li>
          <li>
            <span className="text-foreground font-medium">90-day deletion window.</span> Tweets
            older than 90 days are no longer actively checked for deletion. Older content is
            preserved in the archive but will not receive new deletion events.
          </li>
          <li>
            <span className="text-foreground font-medium">Media.</span> Tweet text and metadata are
            archived. Attached images and video are not yet stored — media links will break if the
            original is removed from X.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">Transparency</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          All attestations are submitted to a single public HCS topic on Hedera Mainnet. Anyone can
          read the full message history independently, no account or login required.
        </p>
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">HCS Topic:</span>
            <span className="font-mono text-foreground">0.0.10301350</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Network:</span>
            <span className="font-mono text-foreground">Hedera Mainnet</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Public explorer:</span>
            <a
              href="https://hashscan.io/mainnet/topic/0.0.10301350"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-foreground underline underline-offset-2 hover:text-muted-foreground"
            >
              hashscan.io/mainnet/topic/0.0.10301350 ↗
            </a>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">Support this project</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Signal Archive is independently built and funded. If you find it useful, you can
          support it directly with HBAR or USDC via your Hedera wallet. Donations go toward
          Hedera network fees, infrastructure, and ongoing development.
        </p>
        <Link
          href="/donate"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          <IconHeart size={16} />
          Donate to Signal Archive
        </Link>
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
