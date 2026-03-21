"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { absoluteDate } from "@/lib/format";
import { CopyButton } from "@/components/copy-button";

interface AttestationItem {
  id: string;
  tweetId: string | null;
  topicId: string;
  transactionId: string;
  contentHash: string;
  sequenceNumber: number;
  consensusTimestamp: string;
}

interface AttestationsListProps {
  username: string;
}

const NETWORK = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "mainnet";

export function AttestationsList({ username }: AttestationsListProps) {
  const [items, setItems] = useState<AttestationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/accounts/${encodeURIComponent(username)}/attestations?page=${page}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => {
        const rows: AttestationItem[] = data.attestations ?? [];
        setItems((prev) => (page === 1 ? rows : [...prev, ...rows]));
        setHasMore(rows.length === (data.pageSize ?? 25));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [username, page]);

  if (loading && page === 1) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Failed to load attestations.
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No attestations recorded yet.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-col divide-y divide-border">
        {items.map((a) => (
          <div key={a.id} className="py-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Consensus Timestamp</dt>
                <dd className="font-mono">{absoluteDate(new Date(a.consensusTimestamp))}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Sequence #</dt>
                <dd className="font-mono">{a.sequenceNumber}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Transaction ID</dt>
                <dd className="font-mono break-all">
                  <a
                    href={`https://hashscan.io/${NETWORK}/transaction/${a.transactionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {a.transactionId}
                  </a>
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Content Hash</dt>
                <dd className="flex items-center gap-1.5 font-mono break-all">
                  <span className="text-muted-foreground">{a.contentHash.slice(0, 20)}…</span>
                  <CopyButton text={a.contentHash} />
                  {a.tweetId && (
                    <Link
                      href={`/tweet/${a.tweetId}`}
                      className="ml-2 text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      View proof →
                    </Link>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={loading}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
