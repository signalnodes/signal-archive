// Cost note: single indexed query on account_id + posted_at. Thin select —
// only fields required by TweetCard. No engagement, no raw_json.
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, tweets } from "@taa/db";
import { getAccountByUsername, parsePage } from "@/lib/api-helpers";

const PAGE_SIZE = 25;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const url = new URL(_req.url);
  const page = parsePage(url.searchParams.get("page"));
  const offset = (page - 1) * PAGE_SIZE;

  const db = getDb();
  const account = await getAccountByUsername(db, username);

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Strict select shape — only what TweetCard needs. No engagement.
  const rows = await db
    .select({
      id: tweets.id,
      tweetId: tweets.tweetId,
      content: tweets.content,
      tweetType: tweets.tweetType,
      isDeleted: tweets.isDeleted,
      postedAt: tweets.postedAt,
      mediaUrls: tweets.mediaUrls,
    })
    .from(tweets)
    .where(eq(tweets.accountId, account.id))
    .orderBy(desc(tweets.postedAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  return NextResponse.json({ tweets: rows, page, pageSize: PAGE_SIZE }, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
