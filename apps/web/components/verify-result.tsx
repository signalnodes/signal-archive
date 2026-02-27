import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
            <Badge variant="outline" className="text-muted-foreground">
              NOT FOUND
            </Badge>
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
            <Badge className="bg-green-600 hover:bg-green-600 text-white">
              HASH MATCH + HEDERA PROOF
            </Badge>
          ) : (
            <Badge variant="outline" className="border-yellow-500/60 text-yellow-500">
              HASH MATCH - ATTESTATION PENDING
            </Badge>
          )}
          {tweet.isDeleted && (
            <Badge variant="destructive" className="text-xs">
              DELETED
            </Badge>
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
                <dt className="text-muted-foreground">Hedera Transaction</dt>
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
                <dt className="text-muted-foreground">Consensus Timestamp</dt>
                <dd className="font-mono">{absoluteDate(attestation.consensusTimestamp)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sequence Number</dt>
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
