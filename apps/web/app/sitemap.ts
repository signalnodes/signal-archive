import type { MetadataRoute } from "next";
import { getDb, tweets, trackedAccounts } from "@taa/db";
import { eq } from "drizzle-orm";

const BASE_URL = "https://signalarchive.org";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();

  const [accounts, allTweets] = await Promise.all([
    db
      .select({ username: trackedAccounts.username, updatedAt: trackedAccounts.updatedAt })
      .from(trackedAccounts)
      .where(eq(trackedAccounts.isActive, true)),
    db
      .select({
        id: tweets.id,
        isDeleted: tweets.isDeleted,
        deletedAt: tweets.deletedAt,
        capturedAt: tweets.capturedAt,
      })
      .from(tweets),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/deletions`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/accounts`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/verify`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const accountPages: MetadataRoute.Sitemap = accounts.map((a) => ({
    url: `${BASE_URL}/accounts/${a.username}`,
    lastModified: a.updatedAt ?? new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  const tweetPages: MetadataRoute.Sitemap = allTweets.map((t) => ({
    url: `${BASE_URL}/tweet/${t.id}`,
    lastModified: t.deletedAt ?? t.capturedAt ?? new Date(),
    // Deleted tweet proofs are immutable and highest SEO value
    changeFrequency: t.isDeleted ? ("never" as const) : ("monthly" as const),
    priority: t.isDeleted ? 0.9 : 0.5,
  }));

  return [...staticPages, ...accountPages, ...tweetPages];
}
