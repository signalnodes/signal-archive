"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RecentDeletionsFeed, type DeletionRow } from "@/components/recent-deletions-feed";

interface DeletionsTabProps {
  username: string;
}

export function DeletionsTab({ username }: DeletionsTabProps) {
  const [deletions, setDeletions] = useState<DeletionRow[]>([]);
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
        // Hydrate date strings
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
