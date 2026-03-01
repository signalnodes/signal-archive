import { createHash } from "node:crypto";
import type { TweetProvider, ScrapedTweet } from "./scraper";
import type { TweetType } from "@taa/shared";

const MOCK_CONTENT_TEMPLATES = [
  "Great progress on our agenda today! The American people deserve results.",
  "Just had an incredible meeting about the future of digital assets.",
  "The mainstream media won't report this, but we are winning BIGLY!",
  "Our economy is doing better than ever. Numbers don't lie!",
  "Thank you to all our amazing supporters across this great nation!",
  "Big announcement coming soon. Stay tuned!",
  "Working hard every day for the people of this country.",
  "The radical left doesn't want you to see this. SHARE!",
  "We are making America great again, one policy at a time.",
  "Had a wonderful conversation with world leaders today.",
  "Our crypto strategy will put America first in the digital economy.",
  "Fake news at it again. They can't handle the truth!",
  "Just signed an executive order that will change everything.",
  "The stock market loves what we're doing. Record highs!",
  "Border security is national security. No exceptions.",
];

function deterministicAuthorId(username: string): string {
  return createHash("md5").update(username).digest("hex").slice(0, 16);
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

export function createMockProvider(): TweetProvider {
  return {
    async fetchTweets(username: string, twitterId: string) {
      const now = Date.now();
      const seed = `${username}-${now}`;
      const rng = seededRandom(seed);

      const count = 2 + Math.floor(rng() * 6); // 2-7 tweets
      const authorId = twitterId || deterministicAuthorId(username);

      const tweets: ScrapedTweet[] = [];

      for (let i = 0; i < count; i++) {
        const templateIdx = Math.floor(rng() * MOCK_CONTENT_TEMPLATES.length);
        const content = `[MOCK] ${MOCK_CONTENT_TEMPLATES[templateIdx]}`;

        // Generate unique tweet ID based on timestamp + index
        const tweetId = `mock_${now}_${i}_${Math.floor(rng() * 100000)}`;

        // Random past timestamp (1 minute to 6 hours ago)
        const ageMs = Math.floor(rng() * 6 * 60 * 60 * 1000) + 60_000;
        const postedAt = new Date(now - ageMs);

        const tweetTypes: TweetType[] = ["tweet", "reply", "retweet", "quote"];
        const tweetType = tweetTypes[Math.floor(rng() * tweetTypes.length)];

        const hasMedia = rng() > 0.7;
        const mediaUrls = hasMedia
          ? [`https://pbs.twimg.com/media/mock_${tweetId}.jpg`]
          : [];

        tweets.push({
          tweetId,
          authorId,
          content,
          postedAt,
          tweetType,
          mediaUrls,
        });
      }

      console.log(
        `[mock-provider] Generated ${tweets.length} mock tweets for @${username}`
      );
      return tweets;
    },
  };
}
