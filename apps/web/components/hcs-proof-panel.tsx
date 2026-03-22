import Link from "next/link";
import { Chip } from "@/components/chip";
import { absoluteDate } from "@/lib/format";
import { CopyButton } from "@/components/copy-button";

interface HcsAttestation {
  transactionId: string;
  topicId: string;
  sequenceNumber: number | string;
  consensusTimestamp: Date;
  contentHash: string;
}

interface HcsProofPanelProps {
  attestation: HcsAttestation | null;
  contentHash: string;
  tweetId: string;
}

export function HcsProofPanel({ attestation, contentHash, tweetId }: HcsProofPanelProps) {
  const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "testnet";

  if (!attestation) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6">
        <h2 className="font-semibold mb-2">Hedera Attestation</h2>
        <p className="text-sm text-muted-foreground">
          HCS attestation pending. This tweet has been captured and hashed but the
          blockchain submission has not yet been confirmed. Attestations are typically
          confirmed within a few minutes of capture.
        </p>
        <div className="flex items-start gap-2 mt-3">
          <p className="text-xs text-muted-foreground font-mono break-all">
            SHA-256: {contentHash}
          </p>
          <CopyButton text={contentHash} />
        </div>
      </div>
    );
  }

  const explorerUrl = `https://hashscan.io/${network}/transaction/${attestation.transactionId}`;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-semibold font-editorial">Hedera Consensus Service Proof</h2>
        <Chip variant="verified">Verified</Chip>
      </div>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Transaction ID</dt>
          <dd className="font-mono text-xs">
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground break-all"
            >
              {attestation.transactionId}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Topic ID</dt>
          <dd className="font-mono text-xs">{attestation.topicId}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Sequence Number</dt>
          <dd className="font-mono text-xs">{String(attestation.sequenceNumber)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Consensus Timestamp</dt>
          <dd className="font-mono text-xs">{absoluteDate(attestation.consensusTimestamp)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Content Hash (SHA-256)</dt>
          <dd className="flex items-start gap-2">
            <span className="font-mono text-xs break-all text-muted-foreground">{contentHash}</span>
            <CopyButton text={contentHash} />
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground mt-4 pt-4 border-t leading-relaxed">
        This transaction on the Hedera public ledger proves this tweet&apos;s content existed
        and was unaltered as of the consensus timestamp above.{" "}
        <Link
          href={`/verify/${contentHash}`}
          className="underline underline-offset-2 hover:text-foreground"
        >
          Verify independently →
        </Link>
      </p>
    </div>
  );
}
