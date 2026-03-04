import { z } from "zod";
import { applyJitter } from "@taa/shared";

export interface DeletionChecker {
  checkTweets(tweetIds: string[]): Promise<Map<string, boolean>>;
}

const TweetStatusSchema = z.object({
  exists: z.boolean(),
});

function createStagehandDeletionChecker(): DeletionChecker {
  return {
    async checkTweets(tweetIds: string[]) {
      const results = new Map<string, boolean>();

      const { Stagehand } = await import("@browserbasehq/stagehand");
      const stagehand = new Stagehand({
        env:
          (process.env.STAGEHAND_ENV as "LOCAL" | "BROWSERBASE") || "LOCAL",
        apiKey: process.env.ANTHROPIC_API_KEY,
        browserbaseSessionCreateParams:
          process.env.STAGEHAND_ENV === "BROWSERBASE"
            ? { projectId: process.env.BROWSERBASE_PROJECT_ID! }
            : undefined,
      });

      try {
        await stagehand.init();

        for (const tweetId of tweetIds) {
          try {
            const url = `https://x.com/i/status/${tweetId}`;
            await stagehand.act(`Navigate to ${url}`);
            await new Promise((r) => setTimeout(r, applyJitter(1500)));

            const result = await stagehand.extract(
              'Does this page show an actual tweet with content? Set exists=true if a tweet is visible. Set exists=false if the page shows "this post is unavailable", "this page doesn\'t exist", "this account has been suspended", "this post was deleted", or any other error/removal message.',
              TweetStatusSchema as any
            );

            const parsed = result as z.infer<typeof TweetStatusSchema>;
            results.set(tweetId, parsed.exists);
          } catch {
            // If navigation fails, assume tweet still exists to avoid false positives
            results.set(tweetId, true);
          }
        }
      } finally {
        await stagehand.close();
      }

      return results;
    },
  };
}

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

  // Legacy: Stagehand browser automation fallback
  if (process.env.ANTHROPIC_API_KEY) {
    return createStagehandDeletionChecker();
  }

  throw new Error(
    "SOCIALDATA_API_KEY (or ANTHROPIC_API_KEY for legacy Stagehand mode) is required when MOCK_INGESTION is not enabled"
  );
}
