"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RecentDeletionsFeed, type DeletionRow } from "@/components/recent-deletions-feed";
import { formatDistanceToNow } from "date-fns";

interface MassDeletionEvent {
  id: string;
  windowStart: string;
  windowEnd: string;
  deletionCount: number;
  detectedAt: string;
}

interface DeletionsTabProps {
  username: string;
}

export function DeletionsTab({ username }: DeletionsTabProps) {
  const [deletions, setDeletions] = useState<DeletionRow[]>([]);
  const [massEvents, setMassEvents] = useState<MassDeletionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/accounts/${encodeURIComponent(username)}/deletions?page=${page}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => {
        const rows: DeletionRow[] = (data.deletions ?? []).map(
          (r: DeletionRow) => ({
            ...r,
            deletion: {
              ...r.deletion,
              detectedAt: new Date(r.deletion.detectedAt),
            },
          })
        );
        setDeletions((prev) => (page === 1 ? rows : [...prev, ...rows]));
        setHasMore(rows.length === (data.pageSize ?? 25));
        if (page === 1) setMassEvents(data.massDeletionEvents ?? []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [username, page]);

  if (loading && page === 1) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Failed to load deletions.</p>;
  }

  return (
    <div>
      {massEvents.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {massEvents.map((e) => (
            <div
              key={e.id}
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
            >
              <span className="font-semibold text-destructive">Mass deletion detected: </span>
              <span className="text-foreground">
                {e.deletionCount} tweets deleted within 1 hour,{" "}
                {formatDistanceToNow(new Date(e.detectedAt), { addSuffix: true })}
              </span>
              <span className="block mt-1 text-xs text-muted-foreground">
                This may indicate coordinated cleanup. Review individual deletions below for context.
              </span>
            </div>
          ))}
        </div>
      )}
      <RecentDeletionsFeed deletions={deletions} />
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
