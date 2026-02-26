export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, tweets, trackedAccounts } from "@taa/db";
import { TweetCard } from "@/components/tweet-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Search",
  description: "Search all archived tweets by keyword, phrase, or account.",
};

interface Props {
  searchParams: Promise<{ q?: string; filter?: string }>;
}

const PAGE_SIZE = 25;

export default async function SearchPage({ searchParams }: Props) {
  const { q, filter } = await searchParams;
  const query = q?.trim() ?? "";
  const deletedOnly = filter === "deleted";

  let results: {
    tweet: {
      id: string;
      tweetId: string;
      content: string;
      tweetType: string;
      isDeleted: boolean;
      postedAt: Date;
      engagement: unknown;
      mediaUrls: string[] | null;
    };
    username: string | null;
  }[] = [];

  if (query.length > 0) {
    const db = getDb();
    const rows = await db
      .select({
        tweet: {
          id: tweets.id,
          tweetId: tweets.tweetId,
          content: tweets.content,
          tweetType: tweets.tweetType,
          isDeleted: tweets.isDeleted,
          postedAt: tweets.postedAt,
          engagement: tweets.engagement,
          mediaUrls: tweets.mediaUrls,
        },
        username: trackedAccounts.username,
      })
      .from(tweets)
      .leftJoin(trackedAccounts, eq(tweets.accountId, trackedAccounts.id))
      .where(
        and(
          sql`to_tsvector('english', ${tweets.content}) @@ websearch_to_tsquery('english', ${query})`,
          deletedOnly ? eq(tweets.isDeleted, true) : undefined
        )
      )
      .orderBy(
        sql`ts_rank(to_tsvector('english', ${tweets.content}), websearch_to_tsquery('english', ${query})) DESC`,
        desc(tweets.postedAt)
      )
      .limit(PAGE_SIZE);

    results = rows;
  }

  const filterBase = query ? `?q=${encodeURIComponent(query)}` : "";

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Search</h1>

      {/* Search form */}
      <form method="GET" action="/search" className="flex gap-2 mb-6">
        <Input
          name="q"
          defaultValue={query}
          placeholder='Search archived tweets — try "crypto", "deleted", "Trump"'
          className="max-w-xl"
          autoFocus={!query}
        />
        {filter === "deleted" && (
          <input type="hidden" name="filter" value="deleted" />
        )}
        <Button type="submit">Search</Button>
      </form>

      {/* Filter pills — only show once a query is active */}
      {query && (
        <div className="flex gap-2 mb-6">
          <Link
            href={`/search?q=${encodeURIComponent(query)}`}
            className={`text-sm px-3 py-1.5 rounded border transition-colors ${
              !deletedOnly
                ? "bg-foreground text-background border-foreground"
                : "hover:bg-muted border-border"
            }`}
          >
            All tweets
          </Link>
          <Link
            href={`/search?q=${encodeURIComponent(query)}&filter=deleted`}
            className={`text-sm px-3 py-1.5 rounded border transition-colors ${
              deletedOnly
                ? "bg-destructive text-destructive-foreground border-destructive"
                : "hover:bg-muted border-border"
            }`}
          >
            Deleted only
          </Link>
        </div>
      )}

      {/* Results */}
      {query && (
        <p className="text-sm text-muted-foreground mb-4">
          {results.length === 0
            ? `No results for "${query}"${deletedOnly ? " (deleted only)" : ""}`
            : `${results.length === PAGE_SIZE ? `${PAGE_SIZE}+` : results.length} result${results.length === 1 ? "" : "s"} for "${query}"${deletedOnly ? " — deleted only" : ""}`}
        </p>
      )}

      {!query && (
        <div className="text-sm text-muted-foreground py-12 text-center space-y-2">
          <p>Search across all archived tweets.</p>
          <p className="text-xs">
            Supports phrases (<span className="font-mono">"exact phrase"</span>
            ), exclusions (<span className="font-mono">-word</span>), and
            boolean (
            <span className="font-mono">word1 OR word2</span>).
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {results.map((row) => (
          <div key={row.tweet.id}>
            {row.username && (
              <Link
                href={`/accounts/${row.username}`}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-1 inline-block"
              >
                @{row.username}
              </Link>
            )}
            <TweetCard
              tweet={row.tweet}
              username={row.username ?? "unknown"}
            />
          </div>
        ))}
      </div>

      {results.length === PAGE_SIZE && (
        <p className="text-xs text-muted-foreground text-center mt-6">
          Showing top {PAGE_SIZE} results. Refine your query to narrow down.
        </p>
      )}
    </div>
  );
}
