// Cost note: single indexed query on account_id. Thin select — no heavy joins
// beyond the required account username lookup (already in deletionEvents.accountId).
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, deletionEvents, trackedAccounts } from "@taa/db";

const PAGE_SIZE = 25;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const url = new URL(_req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const db = getDb();

  const [account] = await db
    .select({ id: trackedAccounts.id, username: trackedAccounts.username, displayName: trackedAccounts.displayName, category: trackedAccounts.category, avatarUrl: trackedAccounts.avatarUrl })
    .from(trackedAccounts)
    .where(eq(trackedAccounts.username, username))
    .limit(1);

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  return NextResponse.json({ deletions, page, pageSize: PAGE_SIZE });
}
