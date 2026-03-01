import { Stagehand } from "@browserbasehq/stagehand";
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

function createStagehandProvider(): TweetProvider {
  return {
    async fetchTweets(username: string, _twitterId: string) {
      const stagehand = new Stagehand({
        env: (process.env.STAGEHAND_ENV as "LOCAL" | "BROWSERBASE") || "LOCAL",
        apiKey: process.env.ANTHROPIC_API_KEY,
        browserbaseSessionCreateParams:
          process.env.STAGEHAND_ENV === "BROWSERBASE"
            ? {
                projectId: process.env.BROWSERBASE_PROJECT_ID!,
              }
            : undefined,
      });

      try {
        await stagehand.init();
        await stagehand.act(`Navigate to https://x.com/${username}`);

        // Scroll 3 times to load more tweets
        for (let pass = 0; pass < 3; pass++) {
          await stagehand.act("Scroll down the page to load more tweets");
          await new Promise((r) =>
            setTimeout(r, applyJitter(2000))
          );
        }

        const extractInstruction = `Extract all visible tweets from this X/Twitter profile page for @${username}. For each tweet get: the tweet ID from the link URL, the author's numeric ID if visible (otherwise use the username), the text content, the posted time, whether it's a tweet/reply/retweet/quote, and any media URLs.`;

        // Schema cast needed: Stagehand v3 bundles Zod 4 but accepts Zod 3
        // schemas at runtime via its zod/v3 compat layer
        const result = await stagehand.extract(
          extractInstruction,
          TweetExtractionSchema as any,
        );

        const parsed = result as z.infer<typeof TweetExtractionSchema>;
        return parsed.tweets.map((t) => ({
          tweetId: t.tweetId,
          authorId: t.authorId,
          content: t.content,
          postedAt: parseTwitterDate(t.postedAt),
          tweetType: t.tweetType,
          mediaUrls: t.mediaUrls,
        }));
      } finally {
        await stagehand.close();
      }
    },
  };
}

export function createProvider(): TweetProvider {
  const useMock = process.env.MOCK_INGESTION === "true";

  if (useMock) {
    // Lazy import to avoid loading mock code in production
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

  // Legacy: Stagehand browser automation fallback
  if (process.env.ANTHROPIC_API_KEY) {
    return createStagehandProvider();
  }

  throw new Error(
    "SOCIALDATA_API_KEY (or ANTHROPIC_API_KEY for legacy Stagehand mode) is required when MOCK_INGESTION is not enabled"
  );
}
