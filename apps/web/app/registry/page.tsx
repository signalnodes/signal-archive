import type { Metadata } from "next";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Topic Registry",
  description:
    "Signal Archive's public HCS-2 topic registry. A machine-readable index of all Hedera Consensus Service topics used by Signal Archive, independently verifiable on-chain.",
  openGraph: {
    title: "Topic Registry - Signal Archive",
    description:
      "Signal Archive's public HCS-2 topic registry. A machine-readable index of all Hedera Consensus Service topics used by Signal Archive, independently verifiable on-chain.",
  },
};

const REGISTRY_TOPIC_ID = "0.0.10388911";

const registeredTopics = [
  {
    topicId: "0.0.10301350",
    role: "Tweet Attestations",
    description:
      "SHA-256 content hashes of archived tweets from tracked public figures, submitted at time of capture. Each message attests that a tweet existed with specific content at a specific consensus timestamp.",
    status: "active" as const,
    hashscanUrl: "https://hashscan.io/mainnet/topic/0.0.10301350",
    verifyPath: "/verify",
  },
];

const statusLabel: Record<"active" | "legacy" | "planned", string> = {
  active: "Active",
  legacy: "Legacy",
  planned: "Planned",
};

export default function RegistryPage() {
  return (
    <div className="container mx-auto max-w-screen-md px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-3 font-editorial">
        Topic Registry
      </h1>
      <p className="text-lg text-muted-foreground leading-relaxed mb-10">
        Signal Archive publishes its Hedera topics through a public HCS-2
        registry so third parties can independently discover and verify the
        archive structure without relying on this website.
      </p>

      <Separator className="mb-10" />

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3 font-editorial">
          Registry topic
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          The registry itself is an HCS-2 indexed topic on Hedera Mainnet. Each
          message in this topic is a standardized registration record for one of
          Signal Archive&apos;s operational HCS topics. Anyone can read the full
          registration history directly from the ledger.
        </p>
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Registry topic:</span>
            <span className="font-mono text-foreground">{REGISTRY_TOPIC_ID}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Standard:</span>
            <span className="font-mono text-foreground">HCS-2</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Network:</span>
            <span className="font-mono text-foreground">Hedera Mainnet</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Public explorer:</span>
            <a
              href={`https://hashscan.io/mainnet/topic/${REGISTRY_TOPIC_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-foreground underline underline-offset-2 hover:text-muted-foreground"
            >
              hashscan.io/mainnet/topic/{REGISTRY_TOPIC_ID} ↗
            </a>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 font-editorial">
          Registered topics
        </h2>
        <div className="space-y-4">
          {registeredTopics.map((topic) => (
            <div
              key={topic.topicId}
              className="rounded-lg border bg-muted/40 px-4 py-4 text-sm space-y-3"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-foreground font-medium">
                    {topic.topicId}
                  </span>
                  <span className="text-xs font-medium text-foreground bg-foreground/10 rounded px-1.5 py-0.5">
                    {topic.role}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                  {statusLabel[topic.status]}
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {topic.description}
              </p>
              <div className="flex gap-4 flex-wrap">
                <a
                  href={topic.hashscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs underline underline-offset-2 hover:text-foreground text-muted-foreground"
                >
                  View on HashScan ↗
                </a>
                <Link
                  href={topic.verifyPath}
                  className="text-xs underline underline-offset-2 hover:text-foreground text-muted-foreground"
                >
                  Verify a hash →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3 font-editorial">
          What is HCS-2?
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          HCS-2 is a Topic Registry standard for the Hedera Consensus Service.
          It provides a standardized way to publish and discover HCS topics,
          making archives and protocols legible to external builders, auditors,
          and indexers without relying solely on a website or documentation.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          By publishing this registry, Signal Archive ensures that the
          authoritative topic list is itself on-chain and independently
          verifiable, not just stated in copy on this page.
        </p>
      </section>

      <Separator className="mb-10" />

      <section>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Registry topic{" "}
          <span className="font-mono">{REGISTRY_TOPIC_ID}</span> was created on
          Hedera Mainnet on March 22, 2026. Registration messages follow the
          HCS-2 standard JSON format with fields{" "}
          <span className="font-mono">p</span>,{" "}
          <span className="font-mono">op</span>,{" "}
          <span className="font-mono">t_id</span>, and{" "}
          <span className="font-mono">metadata</span>.
        </p>
      </section>
    </div>
  );
}
