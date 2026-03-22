import Link from "next/link";
import { Chip } from "@/components/chip";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { absoluteDate } from "@/lib/format";

interface VerifyResultProps {
  hash: string;
  tweet: {
    id: string;
    content: string;
    postedAt: Date;
    isDeleted: boolean;
  } | null;
  account: {
    username: string;
  } | null;
  attestation: {
    transactionId: string;
    topicId: string;
    sequenceNumber: number | string;
    consensusTimestamp: Date;
  } | null;
}

export function VerifyResult({ hash, tweet, account, attestation }: VerifyResultProps) {
  if (!tweet) {
    return (
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Chip variant="neutral">Not Found</Chip>
          </div>
          <p className="text-sm text-muted-foreground">
            No tweet with hash{" "}
            <code className="font-mono bg-muted px-1 rounded text-xs break-all">{hash}</code>{" "}
            exists in the archive.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasProof = attestation != null;

  return (
    <Card className={hasProof ? "border-green-500/40" : "border-yellow-500/30"}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          {hasProof ? (
            <Chip variant="verified">Hash Match · Hedera Proof</Chip>
          ) : (
            <Chip variant="pending">Hash Match · Attestation Pending</Chip>
          )}
          {tweet.isDeleted && (
            <Chip variant="deleted">Deleted</Chip>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          A tweet matching this content hash was found in the archive.
        </p>

        <blockquote className="border-l-2 border-muted pl-4 mb-4">
          <p className="text-sm text-muted-foreground line-clamp-4">{tweet.content}</p>
        </blockquote>

        <div className="text-sm space-y-1">
          {account && (
            <p>
              Author:{" "}
              <Link
                href={`/accounts/${account.username}`}
                className="underline underline-offset-2 hover:text-foreground"
              >
                @{account.username}
              </Link>
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Posted: {absoluteDate(tweet.postedAt)}
          </p>
        </div>

        {attestation && (
          <>
            <Separator className="my-4" />
            <dl className="text-xs space-y-2">
              <div>
                <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">Hedera Transaction</dt>
                <dd className="font-mono break-all">
                  <a
                    href={`https://hashscan.io/${process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "mainnet"}/transaction/${attestation.transactionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {attestation.transactionId}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">Consensus Timestamp</dt>
                <dd className="font-mono">{absoluteDate(attestation.consensusTimestamp)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">Sequence Number</dt>
                <dd className="font-mono">{String(attestation.sequenceNumber)}</dd>
              </div>
            </dl>
          </>
        )}

        <div className="mt-4 pt-4 border-t">
          <Link
            href={`/tweet/${tweet.id}`}
            className="text-sm underline underline-offset-2 hover:text-foreground"
          >
            View full tweet record →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
