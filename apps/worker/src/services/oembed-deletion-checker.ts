import type { DeletionChecker, TweetRef } from "./deletion-checker";
import { RateLimiter, withBackoff } from "./rate-limiter";

const OEMBED_BASE = "https://publish.twitter.com/oembed?url=";

export function createOEmbedDeletionChecker(): DeletionChecker {
  // Conservative limit — oEmbed has no published rate limit.
  // Actual usage is ~7 req/min at current batch size, well under this.
  const oEmbedLimiter = new RateLimiter(30, 30 / 60_000);

  return {
    async checkTweets(tweets: TweetRef[]) {
      const results = new Map<string, boolean>();

      for (const { tweetId, username } of tweets) {
        await oEmbedLimiter.acquire();

        // Use canonical username-based URL — /i/web/status/ returns 404 for existing tweets
        const url = `${OEMBED_BASE}https://x.com/${username}/status/${tweetId}`;

        try {
          const response = await withBackoff(() =>
            fetch(url, { signal: AbortSignal.timeout(8000) })
          );

          if (response.status === 404) {
            results.set(tweetId, false);
          } else {
            if (response.status !== 200) {
              console.warn(
                `[oembed-deletion] Unexpected status ${response.status} for tweet ${tweetId}, assuming exists`
              );
            }
            results.set(tweetId, true);
          }
        } catch (error) {
          console.warn(
            `[oembed-deletion] Error checking tweet ${tweetId}:`,
            error
          );
          results.set(tweetId, true);
        }
      }

      const deletedCount = [...results.values()].filter((v) => !v).length;
      if (deletedCount > 0) {
        console.log(
          `[oembed-deletion] Checked ${tweets.length} tweets, ${deletedCount} detected as deleted`
        );
      }

      return results;
    },
  };
}
