export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { getDb, deletionEvents, trackedAccounts } from "@taa/db";
import { RecentDeletionsFeed } from "@/components/recent-deletions-feed";
import { DeletionFilters } from "@/components/deletion-filters";

export const metadata: Metadata = { title: "Deletion Feed" };

interface Props {
  searchParams: Promise<{ category?: string }>;
}

export default async function DeletionsPage({ searchParams }: Props) {
  const { category } = await searchParams;
  const db = getDb();

  const baseQuery = db
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

  const [deletions, categoryRows] = await Promise.all([
    (category
      ? baseQuery.where(eq(trackedAccounts.category, category))
      : baseQuery
    )
      .orderBy(desc(deletionEvents.detectedAt))
      .limit(50),
    db
      .selectDistinct({ category: trackedAccounts.category })
      .from(trackedAccounts)
      .where(eq(trackedAccounts.isActive, true)),
  ]);

  const categories = categoryRows.map((r) => r.category).filter(Boolean) as string[];

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Deletion Feed</h1>
      <p className="text-muted-foreground mb-6">
        Reverse-chronological record of all detected tweet deletions.
        {category && (
          <span className="ml-1">
            Filtered by:{" "}
            <span className="text-foreground font-medium">{category.replace(/_/g, " ")}</span>
          </span>
        )}
      </p>
      <DeletionFilters categories={categories} activeCategory={category ?? null} />
      <div className="mt-6">
        <RecentDeletionsFeed deletions={deletions} />
      </div>
    </div>
  );
}
