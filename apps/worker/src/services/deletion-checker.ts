import { z } from "zod";
import { seededRandom } from "@taa/shared";

export interface TweetRef {
  tweetId: string;
  username: string;
}

export interface DeletionChecker {
  checkTweets(tweets: TweetRef[]): Promise<Map<string, boolean>>;
}

const TweetStatusSchema = z.object({
  exists: z.boolean(),
});

function createMockDeletionChecker(): DeletionChecker {
  return {
    async checkTweets(tweets: TweetRef[]) {
      const results = new Map<string, boolean>();
      const rng = seededRandom(`deletion-${Date.now()}`);

      for (const { tweetId } of tweets) {
        // ~15% chance of being detected as deleted
        const stillExists = rng() > 0.15;
        results.set(tweetId, stillExists);
      }

      const deletedCount = [...results.values()].filter((v) => !v).length;
      console.log(
        `[mock-deletion-checker] Checked ${tweets.length} tweets, ${deletedCount} marked as deleted`
      );

      return results;
    },
  };
}

export function createDeletionChecker(): DeletionChecker {
  const useMock = process.env.MOCK_INGESTION === "true";

  if (useMock) {
    return createMockDeletionChecker();
  }

  if (process.env.SOCIALDATA_API_KEY) {
    const { createSocialDataDeletionChecker } = require("./socialdata-deletion-checker");
    return createSocialDataDeletionChecker();
  }

  const { createOEmbedDeletionChecker } = require("./oembed-deletion-checker");
  console.log("[deletion-checker] No SOCIALDATA_API_KEY — using oEmbed fallback");
  return createOEmbedDeletionChecker();
}

// Keep schema export in case it's referenced elsewhere
export { TweetStatusSchema };
