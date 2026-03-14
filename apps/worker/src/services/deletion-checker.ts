import { z } from "zod";
import { seededRandom } from "@taa/shared";

export interface DeletionChecker {
  checkTweets(tweetIds: string[]): Promise<Map<string, boolean>>;
}

const TweetStatusSchema = z.object({
  exists: z.boolean(),
});

function createMockDeletionChecker(): DeletionChecker {
  return {
    async checkTweets(tweetIds: string[]) {
      const results = new Map<string, boolean>();
      const rng = seededRandom(`deletion-${Date.now()}`);

      for (const tweetId of tweetIds) {
        // ~15% chance of being detected as deleted
        const stillExists = rng() > 0.15;
        results.set(tweetId, stillExists);
      }

      const deletedCount = [...results.values()].filter((v) => !v).length;
      console.log(
        `[mock-deletion-checker] Checked ${tweetIds.length} tweets, ${deletedCount} marked as deleted`
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

  throw new Error("SOCIALDATA_API_KEY is required for deletion checking.");
}

// Keep schema export in case it's referenced elsewhere
export { TweetStatusSchema };
