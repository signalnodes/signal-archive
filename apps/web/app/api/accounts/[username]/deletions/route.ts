// Cost note: single indexed query on account_id. Thin select — no heavy joins
// beyond the required account username lookup (already in deletionEvents.accountId).
import { NextResponse } from "next/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, deletionEvents, massDeletionEvents, trackedAccounts } from "@taa/db";
import { parsePage } from "@/lib/api-helpers";

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

  const [account] = await db
    .select({ id: trackedAccounts.id, username: trackedAccounts.username, displayName: trackedAccounts.displayName, category: trackedAccounts.category, avatarUrl: trackedAccounts.avatarUrl })
    .from(trackedAccounts)
    .where(eq(trackedAccounts.username, username))
    .limit(1);

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Mass deletion events in the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const massEvents = await db
    .select({
      id: massDeletionEvents.id,
      windowStart: massDeletionEvents.windowStart,
      windowEnd: massDeletionEvents.windowEnd,
      deletionCount: massDeletionEvents.deletionCount,
      detectedAt: massDeletionEvents.detectedAt,
    })
    .from(massDeletionEvents)
    .where(
      and(
        eq(massDeletionEvents.accountId, account.id),
        gte(massDeletionEvents.detectedAt, thirtyDaysAgo)
      )
    )
    .orderBy(desc(massDeletionEvents.detectedAt))
    .limit(10);

  const rows = await db
    .select({
      deletion: {
        id: deletionEvents.id,
        tweetId: deletionEvents.tweetId,
        contentPreview: deletionEvents.contentPreview,
        detectedAt: deletionEvents.detectedAt,
        tweetAgeHours: deletionEvents.tweetAgeHours,
        severityScore: deletionEvents.severityScore,
      },
    })
    .from(deletionEvents)
    .where(eq(deletionEvents.accountId, account.id))
    .orderBy(desc(deletionEvents.detectedAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  // Shape into DeletionRow format expected by RecentDeletionsFeed
  const deletions = rows.map((r) => ({
    deletion: r.deletion,
    account: {
      id: account.id,
      username: account.username,
      displayName: account.displayName,
      category: account.category,
      avatarUrl: account.avatarUrl,
    },
  }));

  return NextResponse.json({ deletions, massDeletionEvents: massEvents, page, pageSize: PAGE_SIZE }, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
