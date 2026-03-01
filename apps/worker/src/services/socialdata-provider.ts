import type { TweetProvider, ScrapedTweet } from "./scraper";
import type { TweetType } from "@taa/shared";
import { socialDataLimiter, withBackoff } from "./rate-limiter";

const BASE_URL = "https://api.socialdata.tools";

interface SocialDataTweet {
  id_str: string;
  full_text: string;
  tweet_created_at: string;
  user: {
    id_str: string;
    screen_name: string;
  };
  retweeted_status?: unknown;
  in_reply_to_status_id_str: string | null;
  is_quote_status: boolean;
  entities?: {
    media?: Array<{ media_url_https: string }>;
  };
  extended_entities?: {
    media?: Array<{ media_url_https: string }>;
  };
}

function deriveTweetType(tweet: SocialDataTweet): TweetType {
  if (tweet.retweeted_status) return "retweet";
  if (tweet.in_reply_to_status_id_str) return "reply";
  if (tweet.is_quote_status) return "quote";
  return "tweet";
}

function extractMediaUrls(tweet: SocialDataTweet): string[] {
  const media =
    tweet.extended_entities?.media ?? tweet.entities?.media ?? [];
  return media.map((m) => m.media_url_https);
}

function normalize(tweet: SocialDataTweet): ScrapedTweet {
  return {
    tweetId: tweet.id_str,
    authorId: tweet.user.id_str,
    content: tweet.full_text,
    postedAt: new Date(tweet.tweet_created_at),
    tweetType: deriveTweetType(tweet),
    mediaUrls: extractMediaUrls(tweet),
  };
}

export function createSocialDataProvider(): TweetProvider {
  const apiKey = process.env.SOCIALDATA_API_KEY;
  if (!apiKey) {
    throw new Error("SOCIALDATA_API_KEY is required for SocialData provider");
  }

  return {
    async fetchTweets(_username: string, twitterId: string) {
      await socialDataLimiter.acquire();

      const url = `${BASE_URL}/twitter/user/${twitterId}/tweets-and-replies`;
      const response = await withBackoff(() =>
        fetch(url, {
          headers: { Authorization: `Bearer ${apiKey}` },
        }),
      );

      if (!response.ok) {
        throw new Error(
          `SocialData API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      const tweets: SocialDataTweet[] = data.tweets ?? [];

      // Skip retweets — we track what people say, not what they amplify
      return tweets
        .filter((t) => !t.retweeted_status)
        .map(normalize);
    },
  };
}
