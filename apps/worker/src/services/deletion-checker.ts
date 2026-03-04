import { z } from "zod";

export interface DeletionChecker {
  checkTweets(tweetIds: string[]): Promise<Map<string, boolean>>;
}

const TweetStatusSchema = z.object({
  exists: z.boolean(),
});

function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
