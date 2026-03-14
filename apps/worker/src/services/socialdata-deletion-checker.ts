import type { DeletionChecker } from "./deletion-checker";
import { socialDataLimiter, withBackoff } from "./rate-limiter";

const BASE_URL = "https://api.socialdata.tools";

export function createSocialDataDeletionChecker(): DeletionChecker {
  const apiKey = process.env.SOCIALDATA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SOCIALDATA_API_KEY is required for SocialData deletion checker",
    );
  }

  return {
    async checkTweets(tweetIds: string[]) {
      const results = new Map<string, boolean>();

      for (const tweetId of tweetIds) {
        await socialDataLimiter.acquire();

        try {
          const url = `${BASE_URL}/twitter/tweets/${tweetId}`;
          const response = await withBackoff(() =>
            fetch(url, {
              headers: { Authorization: `Bearer ${apiKey}` },
              signal: AbortSignal.timeout(5000),
            }),
          );

          if (response.status === 404) {
            // Tweet deleted
            results.set(tweetId, false);
          } else if (response.status === 403) {
            // Account private — conservatively assume tweet exists
            results.set(tweetId, true);
          } else if (response.ok) {
            results.set(tweetId, true);
          } else {
            // 5xx or unexpected — conservatively assume exists
            console.warn(
              `[socialdata-deletion] Unexpected status ${response.status} for tweet ${tweetId}, assuming exists`,
            );
            results.set(tweetId, true);
          }
        } catch (error) {
          // Network error — conservatively assume exists
          console.warn(
            `[socialdata-deletion] Error checking tweet ${tweetId}:`,
            error,
          );
          results.set(tweetId, true);
        }
      }

      const deletedCount = [...results.values()].filter((v) => !v).length;
      if (deletedCount > 0) {
        console.log(
          `[socialdata-deletion] Checked ${tweetIds.length} tweets, ${deletedCount} detected as deleted`,
        );
      }

      return results;
    },
  };
}
