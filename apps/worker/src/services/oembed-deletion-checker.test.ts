import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOEmbedDeletionChecker } from "./oembed-deletion-checker";
import type { TweetRef } from "./deletion-checker";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockResponse(status: number): Response {
  return { status, ok: status >= 200 && status < 300 } as Response;
}

function ref(tweetId: string, username = "testuser"): TweetRef {
  return { tweetId, username };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("OEmbedDeletionChecker", () => {
  it("marks tweet as existing on 200", async () => {
    mockFetch.mockResolvedValue(mockResponse(200));
    const checker = createOEmbedDeletionChecker();
    const result = await checker.checkTweets([ref("123")]);
    expect(result.get("123")).toBe(true);
  });

  it("marks tweet as deleted on 404", async () => {
    mockFetch.mockResolvedValue(mockResponse(404));
    const checker = createOEmbedDeletionChecker();
    const result = await checker.checkTweets([ref("456")]);
    expect(result.get("456")).toBe(false);
  });

  it("conservatively marks tweet as existing on 403 (protected account)", async () => {
    mockFetch.mockResolvedValue(mockResponse(403));
    const checker = createOEmbedDeletionChecker();
    const result = await checker.checkTweets([ref("789")]);
    expect(result.get("789")).toBe(true);
  });

  it("conservatively marks tweet as existing on 429 (rate limited)", async () => {
    mockFetch.mockResolvedValue(mockResponse(429));
    const checker = createOEmbedDeletionChecker();
    const result = await checker.checkTweets([ref("101")]);
    expect(result.get("101")).toBe(true);
  });

  it("conservatively marks tweet as existing on network error", async () => {
    mockFetch.mockRejectedValue(new Error("network failure"));
    const checker = createOEmbedDeletionChecker();
    const result = await checker.checkTweets([ref("202")]);
    expect(result.get("202")).toBe(true);
  });

  it("uses canonical username-based URL format in the request", async () => {
    mockFetch.mockResolvedValue(mockResponse(200));
    const checker = createOEmbedDeletionChecker();
    await checker.checkTweets([{ tweetId: "999", username: "realuser" }]);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("x.com/realuser/status/999");
    expect(url).not.toContain("/i/web/status");
  });

  it("handles multiple tweet IDs", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(200))
      .mockResolvedValueOnce(mockResponse(404))
      .mockResolvedValueOnce(mockResponse(200));
    const checker = createOEmbedDeletionChecker();
    const result = await checker.checkTweets([ref("a"), ref("b"), ref("c")]);
    expect(result.get("a")).toBe(true);
    expect(result.get("b")).toBe(false);
    expect(result.get("c")).toBe(true);
  });
});
