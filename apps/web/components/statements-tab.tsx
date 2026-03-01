"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { TweetCard } from "@/components/tweet-card";

interface TweetListItem {
  id: string;
  tweetId: string;
  content: string;
  tweetType: string;
  isDeleted: boolean;
  postedAt: Date;
  mediaUrls: string[] | null;
}

interface StatementsTabProps {
  username: string;
}

const PAGE_SIZE = 25;

export function StatementsTab({ username }: StatementsTabProps) {
  const [tweets, setTweets] = useState<TweetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/accounts/${encodeURIComponent(username)}/statements?page=${page}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => {
        // Dates come as strings from JSON — convert postedAt back to Date
        const rows: TweetListItem[] = (data.tweets ?? []).map(
          (t: TweetListItem & { postedAt: string }) => ({
            ...t,
            postedAt: new Date(t.postedAt),
          })
        );
        setTweets((prev) => (page === 1 ? rows : [...prev, ...rows]));
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [username, page]);

  if (loading && page === 1) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Failed to load statements.</p>;
  }

  if (tweets.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No statements archived yet.</p>;
  }

  return (
    <div>
      <div className="flex flex-col gap-3">
        {tweets.map((tweet) => (
          <TweetCard key={tweet.id} tweet={tweet} username={username} />
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
