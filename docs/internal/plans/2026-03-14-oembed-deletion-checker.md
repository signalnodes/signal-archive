# oEmbed Deletion Checker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` to implement this plan.

**Goal:** Replace the SocialData API deletion checker with a free oEmbed-based implementation, eliminating the SOCIALDATA_API_KEY dependency for deletion detection.
**Architecture:** Add `OEmbedDeletionChecker` implementing the existing `DeletionChecker` interface. Update the factory in `deletion-checker.ts` to fall back to oEmbed when no `SOCIALDATA_API_KEY` is present instead of throwing. The rest of the deletion pipeline (BullMQ job, AI scoring, HCS submission, mass deletion detection) is untouched.
**Tech Stack:** TypeScript, Node.js `fetch`, vitest (new to worker), existing `RateLimiter` + `withBackoff` from `rate-limiter.ts`.

**Verified behavior (empirical test 2026-03-14):**
- `https://publish.twitter.com/oembed?url=https://x.com/i/web/status/{id}`
- Live tweet → `200`
- Deleted tweet → `404` (confirmed immediate, no indexing delay)
- `twitter.com` URL format → false `404` — **must use `x.com`**
- Protected account → `403`
- Rate limited → `429`

---

### Task 1: Add vitest to worker

**Files:**
- Modify: `apps/worker/package.json`
- Create: `apps/worker/vitest.config.ts`

**Step 1: Add vitest devDependency and test script**

In `apps/worker/package.json`, add to `devDependencies`:
```json
"vitest": "^2.0.0"
```
Add to `scripts`:
```json
"test": "vitest run"
```

**Step 2: Create vitest config**

Create `apps/worker/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

**Step 3: Verify**
```bash
cd apps/worker && npm install
npm run test
```
Expected: "No test files found" (passes with 0 tests — setup is valid)

**Step 4: Commit**
```bash
git add apps/worker/package.json apps/worker/vitest.config.ts package-lock.json
git commit -m "chore(worker): add vitest test infrastructure"
```

---

### Task 2: Write failing tests for OEmbedDeletionChecker

**Files:**
- Create: `apps/worker/src/services/oembed-deletion-checker.test.ts`

**Step 1: Write tests**

Create `apps/worker/src/services/oembed-deletion-checker.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOEmbedDeletionChecker } from "./oembed-deletion-checker";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockResponse(status: number): Response {
  return { status, ok: status >= 200 && status < 300 } as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("OEmbedDeletionChecker", () => {
  it("marks tweet as existing on 200", async () => {
    mockFetch.mockResolvedValue(mockResponse(200));
    const checker = createOEmbedDeletionChecker();
    const result = await checker.checkTweets(["123"]);
    expect(result.get("123")).toBe(true);
  });

  it("marks tweet as deleted on 404", async () => {
    mockFetch.mockResolvedValue(mockResponse(404));
    const checker = createOEmbedDeletionChecker();
    const result = await checker.checkTweets(["456"]);
    expect(result.get("456")).toBe(false);
  });

  it("conservatively marks tweet as existing on 403 (protected account)", async () => {
    mockFetch.mockResolvedValue(mockResponse(403));
    const checker = createOEmbedDeletionChecker();
    const result = await checker.checkTweets(["789"]);
    expect(result.get("789")).toBe(true);
  });

  it("conservatively marks tweet as existing on 429 (rate limited)", async () => {
    mockFetch.mockResolvedValue(mockResponse(429));
    const checker = createOEmbedDeletionChecker();
    const result = await checker.checkTweets(["101"]);
    expect(result.get("101")).toBe(true);
  });

  it("conservatively marks tweet as existing on network error", async () => {
    mockFetch.mockRejectedValue(new Error("network failure"));
    const checker = createOEmbedDeletionChecker();
    const result = await checker.checkTweets(["202"]);
    expect(result.get("202")).toBe(true);
  });

  it("uses x.com URL format in the request", async () => {
    mockFetch.mockResolvedValue(mockResponse(200));
    const checker = createOEmbedDeletionChecker();
    await checker.checkTweets(["999"]);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("x.com/i/web/status/999");
    expect(url).not.toContain("twitter.com/i/web/status");
  });

  it("handles multiple tweet IDs", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(200))
      .mockResolvedValueOnce(mockResponse(404))
      .mockResolvedValueOnce(mockResponse(200));
    const checker = createOEmbedDeletionChecker();
    const result = await checker.checkTweets(["a", "b", "c"]);
    expect(result.get("a")).toBe(true);
    expect(result.get("b")).toBe(false);
    expect(result.get("c")).toBe(true);
  });
});
```

**Step 2: Run tests (expect failure — file doesn't exist yet)**
```bash
cd apps/worker && npm run test
```
Expected: fails with `Cannot find module './oembed-deletion-checker'`

**Step 3: Commit**
```bash
git add apps/worker/src/services/oembed-deletion-checker.test.ts
git commit -m "test(worker): add failing tests for OEmbedDeletionChecker"
```

---

### Task 3: Implement OEmbedDeletionChecker

**Files:**
- Create: `apps/worker/src/services/oembed-deletion-checker.ts`

**Step 1: Implement**

Create `apps/worker/src/services/oembed-deletion-checker.ts`:
```ts
import type { DeletionChecker } from "./deletion-checker";
import { RateLimiter } from "./rate-limiter";

// Conservative limit — oEmbed has no published rate limit.
// Actual usage is ~7 req/min at current batch size, well under this.
const oEmbedLimiter = new RateLimiter(30, 30 / 60_000);

const OEMBED_BASE = "https://publish.twitter.com/oembed?url=";

export function createOEmbedDeletionChecker(): DeletionChecker {
  return {
    async checkTweets(tweetIds: string[]) {
      const results = new Map<string, boolean>();

      for (const tweetId of tweetIds) {
        await oEmbedLimiter.acquire();

        const url = `${OEMBED_BASE}https://x.com/i/web/status/${tweetId}`;

        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(8000),
          });

          if (response.status === 404) {
            results.set(tweetId, false);
          } else {
            // 200, 403 (protected), 429 (rate limited), 5xx — conservatively assume exists
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
          `[oembed-deletion] Checked ${tweetIds.length} tweets, ${deletedCount} detected as deleted`
        );
      }

      return results;
    },
  };
}
```

**Step 2: Run tests**
```bash
cd apps/worker && npm run test
```
Expected: all 7 tests pass

**Step 3: Typecheck**
```bash
npm run typecheck -w apps/worker
```
Expected: no errors

**Step 4: Commit**
```bash
git add apps/worker/src/services/oembed-deletion-checker.ts
git commit -m "feat(worker): implement OEmbedDeletionChecker (free, no API key required)"
```

---

### Task 4: Update factory to fall back to oEmbed

**Files:**
- Modify: `apps/worker/src/services/deletion-checker.ts`

**Step 1: Update factory**

Replace the throw at the end of `createDeletionChecker()` with an oEmbed fallback:

```ts
// Old:
throw new Error("SOCIALDATA_API_KEY is required for deletion checking.");

// New:
const { createOEmbedDeletionChecker } = require("./oembed-deletion-checker");
console.log("[deletion-checker] No SOCIALDATA_API_KEY — using oEmbed fallback");
return createOEmbedDeletionChecker();
```

**Step 2: Run tests**
```bash
npm run test -w apps/worker
```
Expected: all tests still pass

**Step 3: Typecheck**
```bash
npm run typecheck -w apps/worker
```
Expected: no errors

**Step 4: Commit**
```bash
git add apps/worker/src/services/deletion-checker.ts
git commit -m "feat(worker): fall back to oEmbed deletion checker when no SOCIALDATA_API_KEY"
```

---

### Task 5: Full verification and push

**Step 1: Run full test suite**
```bash
npm run test
npm run typecheck
```
Expected: all pass

**Step 2: Smoke test locally**
```bash
MOCK_INGESTION=false npm run dev -w apps/worker
```
Expected: worker starts, logs `[deletion-checker] No SOCIALDATA_API_KEY — using oEmbed fallback` on first deletion check cycle (if no key set in local .env)

**Step 3: Push to Railway**
On Railway, you can now remove `SOCIALDATA_API_KEY` from the worker service env vars (or leave it — if present, SocialData checker is still used as before). No other env changes required.

**Step 4: Commit + push**
```bash
git push
```
Expected: Railway redeploys worker, deletion checks continue uninterrupted
