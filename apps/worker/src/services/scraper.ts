import { z } from "zod";
import { applyJitter } from "@taa/shared";
import type { TweetType } from "@taa/shared";

export interface ScrapedTweet {
  tweetId: string;
  authorId: string;
  content: string;
  postedAt: Date;
  tweetType: TweetType;
  mediaUrls: string[];
}

export interface TweetProvider {
  fetchTweets(username: string, twitterId: string): Promise<ScrapedTweet[]>;
}

const TweetExtractionSchema = z.object({
  tweets: z.array(
    z.object({
      tweetId: z.string(),
      authorId: z.string(),
      content: z.string(),
      postedAt: z.string(),
      tweetType: z.enum(["tweet", "reply", "retweet", "quote"]),
      mediaUrls: z.array(z.string()),
    })
  ),
});

/**
 * Parse X/Twitter's inconsistent date formats into a Date object.
 * Handles: ISO 8601, "Mar 15", "15h", "2m", absolute timestamps, etc.
 */
function parseTwitterDate(raw: string): Date {
  // Already ISO-ish
  const isoDate = new Date(raw);
  if (!isNaN(isoDate.getTime())) return isoDate;

  const now = new Date();

  // Relative: "2m", "15h", "3d"
  const relativeMatch = raw.match(/^(\d+)([smhd])$/);
  if (relativeMatch) {
    const [, amount, unit] = relativeMatch;
    const ms: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return new Date(now.getTime() - parseInt(amount) * ms[unit]);
  }

  // "Mar 15" style (current year)
  const monthDay = new Date(`${raw} ${now.getFullYear()}`);
  if (!isNaN(monthDay.getTime())) return monthDay;

  // Fallback to now
  console.warn(`[scraper] Could not parse date "${raw}", using current time`);
  return now;
}

export function createProvider(): TweetProvider {
  const useMock = process.env.MOCK_INGESTION === "true";

  if (useMock) {
    return {
      async fetchTweets(username, twitterId) {
        const { createMockProvider } = await import("./mock-provider");
        return createMockProvider().fetchTweets(username, twitterId);
      },
    };
  }

  if (process.env.SOCIALDATA_API_KEY) {
    const { createSocialDataProvider } = require("./socialdata-provider");
    return createSocialDataProvider();
  }

  // No API key — return a no-op provider. Ingestion is handled locally via browser-ingest.ts.
  console.log("[scraper] No SOCIALDATA_API_KEY — ingestion worker will be a no-op (use browser-ingest.ts locally)");
  return {
    async fetchTweets() {
      return [];
    },
  };
}

// Re-export schema and types used by socialdata-provider
export { TweetExtractionSchema, parseTwitterDate, applyJitter };
