export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { count, desc, eq, isNotNull } from "drizzle-orm";
import { getDb, deletionEvents, trackedAccounts } from "@taa/db";
import { RecentDeletionsFeed } from "@/components/recent-deletions-feed";
import { DeletionFilters } from "@/components/deletion-filters";
import { DeletionPagination } from "@/components/deletion-pagination";
import { CATEGORY_LABELS } from "@/lib/category";
import type { AccountCategory } from "@taa/shared";

export const metadata: Metadata = { title: "Deletion Feed" };

const PAGE_SIZE = 25;

interface Props {
  searchParams: Promise<{ category?: string; page?: string; sort?: string }>;
}

export default async function DeletionsPage({ searchParams }: Props) {
  const { category, page: pageParam, sort } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const sortBySeverity = sort === "severity";
  const db = getDb();

  const joinedBase = db
    .select({
      deletion: {
        id: deletionEvents.id,
        tweetId: deletionEvents.tweetId,
        contentPreview: deletionEvents.contentPreview,
        detectedAt: deletionEvents.detectedAt,
        tweetAgeHours: deletionEvents.tweetAgeHours,
        severityScore: deletionEvents.severityScore,
      },
      account: {
        id: trackedAccounts.id,
        username: trackedAccounts.username,
        displayName: trackedAccounts.displayName,
        category: trackedAccounts.category,
        avatarUrl: trackedAccounts.avatarUrl,
      },
    })
    .from(deletionEvents)
    .leftJoin(trackedAccounts, eq(deletionEvents.accountId, trackedAccounts.id));

  const countBase = db
    .select({ count: count() })
    .from(deletionEvents)
    .leftJoin(trackedAccounts, eq(deletionEvents.accountId, trackedAccounts.id));

  // Apply category filter + sort
  const filteredQuery = category
    ? joinedBase.where(eq(trackedAccounts.category, category))
    : sortBySeverity
      ? joinedBase.where(isNotNull(deletionEvents.severityScore))
      : joinedBase;

  const orderBy = sortBySeverity
    ? [desc(deletionEvents.severityScore), desc(deletionEvents.detectedAt)]
    : [desc(deletionEvents.detectedAt)];

  const [deletions, totalCountResult, categoryRows] = await Promise.all([
    filteredQuery.orderBy(...orderBy).limit(PAGE_SIZE).offset(offset),
    category ? countBase.where(eq(trackedAccounts.category, category)) : countBase,
    db
      .selectDistinct({ category: trackedAccounts.category })
      .from(trackedAccounts)
      .where(eq(trackedAccounts.isActive, true)),
  ]);

  const total = totalCountResult[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const categories = categoryRows.map((r) => r.category).filter(Boolean) as string[];

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (sortBySeverity) params.set("sort", "severity");
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/deletions${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Deletion Feed</h1>
      <p className="text-muted-foreground mb-6">
        {sortBySeverity
          ? "Deletions ranked by AI-assessed public interest significance."
          : "Reverse-chronological record of all detected tweet deletions."}
        {category && (
          <span className="ml-1">
            Filtered by:{" "}
            <span className="text-foreground font-medium">
              {CATEGORY_LABELS[category as AccountCategory] ?? category}
            </span>
          </span>
        )}
      </p>
      <DeletionFilters
        categories={categories}
        activeCategory={category ?? null}
        activeSort={sortBySeverity ? "severity" : "recent"}
      />
      <div className="mt-6">
        <RecentDeletionsFeed deletions={deletions} />
      </div>
      {totalPages > 1 && (
        <DeletionPagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={buildHref}
        />
      )}
    </div>
  );
}
