import { describe, it, expect } from "vitest";
import { computeContentHash, applyJitter } from "./canonical-hash";
import type { CanonicalTweet } from "./types";

const baseTweet: CanonicalTweet = {
  tweet_id: "1234567890",
  author_id: "9876543210",
  content: "This is a test tweet",
  posted_at: "2026-01-15T12:00:00.000Z",
  media_urls: ["https://pbs.twimg.com/media/abc.jpg"],
  tweet_type: "tweet",
};

describe("computeContentHash", () => {
  it("returns a 64-char hex SHA-256 hash", () => {
    const hash = computeContentHash(baseTweet);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic — same input produces same hash", () => {
    const h1 = computeContentHash(baseTweet);
    const h2 = computeContentHash(baseTweet);
    expect(h1).toBe(h2);
  });

  it("is canonical — key order in input does not matter", () => {
    const reordered = {
      tweet_type: baseTweet.tweet_type,
      media_urls: baseTweet.media_urls,
      content: baseTweet.content,
      posted_at: baseTweet.posted_at,
      author_id: baseTweet.author_id,
      tweet_id: baseTweet.tweet_id,
    } as CanonicalTweet;

    expect(computeContentHash(reordered)).toBe(computeContentHash(baseTweet));
  });

  it("sorts media_urls for canonical form", () => {
    const a: CanonicalTweet = {
      ...baseTweet,
      media_urls: ["https://b.jpg", "https://a.jpg"],
    };
    const b: CanonicalTweet = {
      ...baseTweet,
      media_urls: ["https://a.jpg", "https://b.jpg"],
    };
    expect(computeContentHash(a)).toBe(computeContentHash(b));
  });

  it("different content produces different hash", () => {
    const modified = { ...baseTweet, content: "Different content" };
    expect(computeContentHash(modified)).not.toBe(computeContentHash(baseTweet));
  });

  it("different tweet_id produces different hash", () => {
    const modified = { ...baseTweet, tweet_id: "9999999999" };
    expect(computeContentHash(modified)).not.toBe(computeContentHash(baseTweet));
  });

  it("handles empty content", () => {
    const empty = { ...baseTweet, content: "" };
    const hash = computeContentHash(empty);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(computeContentHash(baseTweet));
  });

  it("handles empty media_urls", () => {
    const noMedia = { ...baseTweet, media_urls: [] };
    const hash = computeContentHash(noMedia);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("handles unicode content", () => {
    const unicode = { ...baseTweet, content: "🚀 Test émojis and ñ characters 中文" };
    const hash = computeContentHash(unicode);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(computeContentHash(unicode)).toBe(hash);
  });

  it("handles special characters in content", () => {
    const special = { ...baseTweet, content: 'Quotes "inside" and \\backslashes\\ and\nnewlines' };
    const hash = computeContentHash(special);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(computeContentHash(special)).toBe(hash);
  });
});

describe("applyJitter", () => {
  it("returns a number within ±30% of base", () => {
    const base = 1000;
    for (let i = 0; i < 100; i++) {
      const result = applyJitter(base);
      expect(result).toBeGreaterThanOrEqual(700);
      expect(result).toBeLessThanOrEqual(1300);
    }
  });

  it("returns an integer", () => {
    expect(Number.isInteger(applyJitter(1000))).toBe(true);
  });

  it("returns 0 for base of 0", () => {
    expect(applyJitter(0)).toBe(0);
  });
});
