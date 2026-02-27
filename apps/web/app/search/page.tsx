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

// Parse "from:username" tokens out of the query string.
// Returns { ftsQuery, fromUser } where fromUser may be null.
function parseQuery(raw: string): { ftsQuery: string; fromUser: string | null } {
  const fromMatch = raw.match(/\bfrom:(\S+)/i);
  const fromUser = fromMatch ? fromMatch[1].replace(/^@/, "") : null;
  const ftsQuery = raw.replace(/\bfrom:\S+/gi, "").trim();
  return { ftsQuery, fromUser };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q, filter } = await searchParams;
  const rawQuery = q?.trim() ?? "";
  const deletedOnly = filter === "deleted";

  const { ftsQuery, fromUser } = parseQuery(rawQuery);
  const hasSearch = ftsQuery.length > 0 || fromUser !== null;

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

  if (hasSearch) {
    const db = getDb();

    const conditions = [
      ftsQuery.length > 0
        ? sql`to_tsvector('english', ${tweets.content}) @@ websearch_to_tsquery('english', ${ftsQuery})`
        : undefined,
      fromUser ? sql`lower(${trackedAccounts.username}) = lower(${fromUser})` : undefined,
      deletedOnly ? eq(tweets.isDeleted, true) : undefined,
    ].filter(Boolean);

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
      .where(and(...(conditions as Parameters<typeof and>)))
      .orderBy(
        ftsQuery.length > 0
          ? sql`ts_rank(to_tsvector('english', ${tweets.content}), websearch_to_tsquery('english', ${ftsQuery})) DESC`
          : desc(tweets.postedAt),
        desc(tweets.postedAt)
      )
      .limit(PAGE_SIZE);

    results = rows;
  }

  const resultSummary = (() => {
    if (!hasSearch) return null;
    const parts = [];
    if (results.length === 0) return `No results`;
    parts.push(`${results.length === PAGE_SIZE ? `${PAGE_SIZE}+` : results.length} result${results.length === 1 ? "" : "s"}`);
    if (ftsQuery) parts.push(`for "${ftsQuery}"`);
    if (fromUser) parts.push(`from @${fromUser}`);
    if (deletedOnly) parts.push("— deleted only");
    return parts.join(" ");
  })();

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Search</h1>

      {/* Search form */}
      <form method="GET" action="/search" className="flex gap-2 mb-6">
        <Input
          name="q"
          defaultValue={rawQuery}
          placeholder='Search tweets — try "crypto" or "from:elonmusk tariffs"'
          className="max-w-xl"
          autoFocus={!rawQuery}
        />
        {filter === "deleted" && (
          <input type="hidden" name="filter" value="deleted" />
        )}
        <Button type="submit">Search</Button>
      </form>

      {/* Filter pills */}
      {hasSearch && (
        <div className="flex gap-2 mb-6">
          <Link
            href={`/search?q=${encodeURIComponent(rawQuery)}`}
            className={`text-sm px-3 py-1.5 rounded border transition-colors ${
              !deletedOnly
                ? "bg-foreground text-background border-foreground"
                : "hover:bg-muted border-border"
            }`}
          >
            All tweets
          </Link>
          <Link
            href={`/search?q=${encodeURIComponent(rawQuery)}&filter=deleted`}
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

      {/* Result count */}
      {resultSummary && (
        <p className="text-sm text-muted-foreground mb-4">{resultSummary}</p>
      )}

      {/* Empty state */}
      {!hasSearch && (
        <div className="text-sm text-muted-foreground py-12 text-center space-y-2">
          <p>Search across all archived tweets.</p>
          <p className="text-xs space-x-3">
            <span><span className="font-mono">"exact phrase"</span> — phrase match</span>
            <span><span className="font-mono">-word</span> — exclude</span>
            <span><span className="font-mono">from:username</span> — filter by account</span>
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
