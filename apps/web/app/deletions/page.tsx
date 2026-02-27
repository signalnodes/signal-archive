export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { getDb, deletionEvents, trackedAccounts } from "@taa/db";
import { RecentDeletionsFeed } from "@/components/recent-deletions-feed";
import { DeletionFilters } from "@/components/deletion-filters";
import { CATEGORY_LABELS } from "@/lib/category";
import type { AccountCategory } from "@taa/shared";

export const metadata: Metadata = { title: "Deletion Feed" };

const PAGE_SIZE = 25;

interface Props {
  searchParams: Promise<{ category?: string; page?: string }>;
}

export default async function DeletionsPage({ searchParams }: Props) {
  const { category, page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;
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
      },
    })
    .from(deletionEvents)
    .leftJoin(trackedAccounts, eq(deletionEvents.accountId, trackedAccounts.id));

  const countBase = db
    .select({ count: count() })
    .from(deletionEvents)
    .leftJoin(trackedAccounts, eq(deletionEvents.accountId, trackedAccounts.id));

  const [deletions, totalCountResult, categoryRows] = await Promise.all([
    (category
      ? joinedBase.where(eq(trackedAccounts.category, category))
      : joinedBase
    )
      .orderBy(desc(deletionEvents.detectedAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    category
      ? countBase.where(eq(trackedAccounts.category, category))
      : countBase,
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
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/deletions${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Deletion Feed</h1>
      <p className="text-muted-foreground mb-6">
        Reverse-chronological record of all detected tweet deletions.
        {category && (
          <span className="ml-1">
            Filtered by:{" "}
            <span className="text-foreground font-medium">{CATEGORY_LABELS[category as AccountCategory] ?? category}</span>
          </span>
        )}
      </p>
      <DeletionFilters categories={categories} activeCategory={category ?? null} />
      <div className="mt-6">
        <RecentDeletionsFeed deletions={deletions} />
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={buildHref(currentPage - 1)}
                className="text-sm px-3 py-1.5 rounded border hover:bg-muted transition-colors"
              >
                ← Previous
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={buildHref(currentPage + 1)}
                className="text-sm px-3 py-1.5 rounded border hover:bg-muted transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
