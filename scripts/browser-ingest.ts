/**
 * Browser-based tweet backfill script.
 *
 * Uses a real Chromium browser with a persistent profile (dummy account logged in)
 * to scrape tweet history from X profiles — no API costs, no SocialData usage.
 *
 * Intercepts X's internal GraphQL UserTweets responses for clean structured data
 * instead of parsing the DOM. Reuses the same hash/DB/HCS pipeline as the worker.
 *
 * First-time setup:
 *   npx playwright install chromium          (downloads browser, ~170MB, once only)
 *   npx tsx --env-file=.env scripts/browser-ingest.ts --login
 *     -> logs into X in the browser window, then close it — session is saved
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/browser-ingest.ts --username elonmusk
 *   npx tsx --env-file=.env scripts/browser-ingest.ts --username elonmusk --since 2024-01-01
 *   npx tsx --env-file=.env scripts/browser-ingest.ts --list ./accounts.txt
 *   npx tsx --env-file=.env scripts/browser-ingest.ts --list ./accounts.txt --dry-run
 *
 * Options:
 *   --username <handle>    Ingest a single account
 *   --list <file>          Text file, one username per line (# comments allowed)
 *   --since <YYYY-MM-DD>   Only import tweets on/after this date (default: no limit)
 *   --login                Open browser for manual login, then exit (saves session)
 *   --dry-run              Parse and log tweets but don't write to DB or queue HCS
 *   --no-hcs               Write to DB but skip queuing HCS attestations
 *   --skip-vpn-check       Skip ProtonVPN detection (read-only check, safe to run)
 *
 * Env vars (add to .env):
 *   BROWSER_PROFILE_DIR    Chrome profile path (default: ~/.signal-archive-browser)
 *   DATABASE_URL           Neon production DB connection string
 *   REDIS_URL              Upstash Redis URL (for HCS queue)
 */

import { chromium } from "playwright";
import { getDb, tweets, trackedAccounts } from "@taa/db";
import { computeContentHash, applyJitter } from "@taa/shared";
import type { CanonicalTweet, TweetType } from "@taa/shared";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { eq } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";
import * as readline from "node:readline";

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

const USERNAME = getArg("--username");
const LIST_FILE = getArg("--list");
const SINCE_RAW = getArg("--since");
const DRY_RUN = hasFlag("--dry-run");
const NO_HCS = hasFlag("--no-hcs");
const LOGIN_MODE = hasFlag("--login");
const SKIP_VPN_CHECK = hasFlag("--skip-vpn-check");

const SINCE: Date | null = SINCE_RAW ? new Date(SINCE_RAW) : null;
const PROFILE_DIR =
  process.env.BROWSER_PROFILE_DIR ??
  path.join(os.homedir(), ".signal-archive-browser");

const MAX_EMPTY_SCROLLS = 3;  // Stop after this many scrolls with no new tweets
const MAX_SCROLLS = 200;      // Hard cap to prevent infinite loops
const SCROLL_DELAY_MS = 3000; // Base delay between scrolls (jitter applied)
// Account delay range: 50–220 seconds, random uniform distribution
const ACCOUNT_DELAY_MIN_MS = 50_000;
const ACCOUNT_DELAY_MAX_MS = 220_000;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Uniform random integer between min and max ms (inclusive). */
function randomBetween(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Wait for a duration while making small randomized mouse movements to mimic
 * a human idly moving their cursor. Splits the total wait into ~800ms steps.
 */
async function humanizeWait(page: import("playwright").Page, ms: number): Promise<void> {
  const steps = Math.max(1, Math.floor(ms / 800));
  const stepMs = ms / steps;
  const { width, height } = page.viewportSize() ?? { width: 1280, height: 900 };

  for (let i = 0; i < steps; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    // steps: how many intermediate mouse positions to interpolate (smoother = more human)
    await page.mouse.move(x, y, { steps: randomBetween(5, 15) });
    await page.waitForTimeout(stepMs);
  }
}

/**
 * Check if ProtonVPN appears to be active. Read-only — no settings are changed.
 *
 * On WSL2: queries the Windows process list via `tasklist.exe` (built-in, safe).
 * On Linux: checks for a `tun` network interface (created by VPN clients).
 * If detection is unavailable, returns null (unknown).
 */
async function detectVpn(): Promise<{ active: boolean; method: string } | null> {
  // WSL2 path: query Windows process list
  try {
    const out = execSync("tasklist.exe 2>/dev/null", {
      encoding: "utf8",
      timeout: 4000,
    }).toLowerCase();
    const active = out.includes("protonvpn");
    return { active, method: "tasklist.exe (Windows)" };
  } catch {
    // Not WSL2 or tasklist unavailable — try Linux interface check
  }

  try {
    const out = execSync("ip link show 2>/dev/null", {
      encoding: "utf8",
      timeout: 2000,
    }).toLowerCase();
    const active = /tun\d|proton/.test(out);
    return { active, method: "ip link (Linux)" };
  } catch {
    return null; // Can't determine
  }
}

/** Pause and wait for the user to press Enter before continuing. */
async function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// X GraphQL response parser
// ---------------------------------------------------------------------------

interface ParsedTweet {
  tweetId: string;
  authorId: string;
  content: string;
  postedAt: Date;
  tweetType: TweetType;
  mediaUrls: string[];
  engagement: { likes: number; retweets: number; replies: number; views: number };
}

function detectTweetType(legacy: Record<string, unknown>): TweetType {
  if (legacy.retweeted_status_result) return "retweet";
  if (legacy.in_reply_to_status_id_str) return "reply";
  if (legacy.is_quote_status) return "quote";
  return "tweet";
}

function extractMedia(legacy: Record<string, unknown>): string[] {
  const entities =
    (legacy.extended_entities as Record<string, unknown> | undefined) ??
    (legacy.entities as Record<string, unknown> | undefined);
  const media = (entities?.media as Array<{ media_url_https: string }>) ?? [];
  return media.map((m) => m.media_url_https);
}

/**
 * Walk the deeply nested X GraphQL UserTweets response and pull out tweet objects.
 */
function parseTweetsFromResponse(body: unknown): ParsedTweet[] {
  const results: ParsedTweet[] = [];

  try {
    const data = (body as Record<string, unknown>).data as Record<string, unknown>;
    const user = (data?.user as Record<string, unknown>)?.result as Record<string, unknown>;
    const timeline = (
      (user?.timeline_v2 as Record<string, unknown>)?.timeline as Record<string, unknown>
    )?.instructions as Array<Record<string, unknown>>;

    if (!Array.isArray(timeline)) return results;

    for (const instruction of timeline) {
      if (instruction.type !== "TimelineAddEntries") continue;
      const entries = instruction.entries as Array<Record<string, unknown>>;
      if (!Array.isArray(entries)) continue;

      for (const entry of entries) {
        // Skip cursor entries
        const entryId = entry.entryId as string;
        if (entryId?.startsWith("cursor-")) continue;

        const content = entry.content as Record<string, unknown>;
        const itemContent = content?.itemContent as Record<string, unknown>;
        const tweetResults = itemContent?.tweet_results as Record<string, unknown>;
        const result = tweetResults?.result as Record<string, unknown>;

        if (!result) continue;

        // Handle TweetWithVisibilityResults wrapper
        const tweetObj =
          result.__typename === "TweetWithVisibilityResults"
            ? (result.tweet as Record<string, unknown>)
            : result;

        if (!tweetObj) continue;

        const legacy = tweetObj.legacy as Record<string, unknown>;
        if (!legacy) continue;

        // Skip retweets
        if (legacy.retweeted_status_result) continue;

        const tweetId = legacy.id_str as string;
        if (!tweetId) continue;

        // Author ID — prefer from user_results, fall back to user_id_str on legacy
        const userResult = (
          (tweetObj.core as Record<string, unknown>)?.user_results as Record<string, unknown>
        )?.result as Record<string, unknown>;
        const authorId =
          (userResult?.legacy as Record<string, unknown>)?.id_str as string ??
          (userResult?.rest_id as string) ??
          (legacy.user_id_str as string) ??
          "";

        const createdAt = legacy.created_at as string;
        if (!createdAt) continue;

        const postedAt = new Date(createdAt);
        if (isNaN(postedAt.getTime())) continue;

        // Views count lives outside legacy
        const viewsRaw = (tweetObj.views as Record<string, unknown>)?.count;
        const views = viewsRaw ? parseInt(viewsRaw as string, 10) : 0;

        results.push({
          tweetId,
          authorId,
          content: (legacy.full_text as string) ?? "",
          postedAt,
          tweetType: detectTweetType(legacy),
          mediaUrls: extractMedia(legacy),
          engagement: {
            likes: (legacy.favorite_count as number) ?? 0,
            retweets: (legacy.retweet_count as number) ?? 0,
            replies: (legacy.reply_count as number) ?? 0,
            views: isNaN(views) ? 0 : views,
          },
        });
      }
    }
  } catch (err) {
    // Partial parse failure — return whatever we got
    console.warn("[parser] Error parsing response:", (err as Error).message);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Redis / HCS queue setup (mirrors apps/worker/src/queues.ts)
// ---------------------------------------------------------------------------

function buildRedisConnection(url: string) {
  const parsed = new URL(url);
  const isTls = parsed.protocol === "rediss:";
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port) : 6379,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    tls: isTls ? {} : undefined,
    maxRetriesPerRequest: null as null,
  };
}

// ---------------------------------------------------------------------------
// Core ingestion logic
// ---------------------------------------------------------------------------

async function ingestAccount(
  username: string,
  page: import("playwright").Page,
  hcsQueue: Queue | null,
  db: ReturnType<typeof getDb>
): Promise<void> {
  console.log(`\n[browser-ingest] Starting @${username}`);

  // Look up account in DB
  const [accountRow] = await db
    .select({ id: trackedAccounts.id, twitterId: trackedAccounts.twitterId })
    .from(trackedAccounts)
    .where(eq(trackedAccounts.username, username))
    .limit(1);

  if (!accountRow) {
    console.warn(
      `[browser-ingest] @${username} not found in tracked_accounts — seed it first, skipping`
    );
    return;
  }

  const accountId = accountRow.id;
  const collectedTweets: ParsedTweet[] = [];
  const seenIds = new Set<string>();
  let emptyScrollCount = 0;
  let scrollCount = 0;
  let hitCutoff = false;

  // Intercept UserTweets and UserTweetsAndReplies GraphQL responses
  const responseHandler = async (response: import("playwright").Response) => {
    const url = response.url();
    if (
      !url.includes("/graphql/") ||
      (!url.includes("UserTweets") && !url.includes("UserTweetsAndReplies"))
    ) {
      return;
    }

    try {
      const body = await response.json().catch(() => null);
      if (!body) return;
      const parsed = parseTweetsFromResponse(body);
      let newThisResponse = 0;
      for (const t of parsed) {
        if (!seenIds.has(t.tweetId)) {
          seenIds.add(t.tweetId);
          collectedTweets.push(t);
          newThisResponse++;
        }
      }
      if (newThisResponse > 0) {
        process.stdout.write(`  intercepted ${newThisResponse} tweets (total: ${collectedTweets.length})\r`);
      }
    } catch {
      // Ignore parse errors for non-JSON responses
    }
  };

  page.on("response", responseHandler);

  try {
    await page.goto(`https://x.com/${username}`, { waitUntil: "domcontentloaded" });
    await humanizeWait(page, applyJitter(3000));

    // Scroll loop
    while (scrollCount < MAX_SCROLLS && !hitCutoff) {
      const countBefore = collectedTweets.length;

      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 3));
      await humanizeWait(page, applyJitter(SCROLL_DELAY_MS));

      const countAfter = collectedTweets.length;
      const newThisScroll = countAfter - countBefore;
      scrollCount++;

      if (newThisScroll === 0) {
        emptyScrollCount++;
        if (emptyScrollCount >= MAX_EMPTY_SCROLLS) {
          console.log(`\n[browser-ingest] No new tweets for ${MAX_EMPTY_SCROLLS} scrolls — reached end of timeline`);
          break;
        }
      } else {
        emptyScrollCount = 0;
      }

      // Check date cutoff against oldest tweet seen so far
      if (SINCE && collectedTweets.length > 0) {
        const oldest = collectedTweets.reduce(
          (a, b) => (a.postedAt < b.postedAt ? a : b)
        );
        if (oldest.postedAt < SINCE) {
          hitCutoff = true;
          console.log(`\n[browser-ingest] Reached --since cutoff (${SINCE_RAW})`);
        }
      }
    }
  } finally {
    page.off("response", responseHandler);
  }

  // Filter by cutoff
  const toProcess = SINCE
    ? collectedTweets.filter((t) => t.postedAt >= SINCE)
    : collectedTweets;

  console.log(
    `\n[browser-ingest] @${username}: ${collectedTweets.length} scraped, ${toProcess.length} within date range`
  );

  if (DRY_RUN) {
    console.log(`[browser-ingest] DRY RUN — not writing to DB`);
    for (const t of toProcess.slice(0, 5)) {
      console.log(`  ${t.tweetId} | ${t.postedAt.toISOString().slice(0, 10)} | ${t.content.slice(0, 60)}`);
    }
    if (toProcess.length > 5) console.log(`  ... and ${toProcess.length - 5} more`);
    return;
  }

  // Write to DB
  let newCount = 0;
  let dupeCount = 0;

  for (const tweet of toProcess) {
    // Skip retweets (belt-and-suspenders, parser already skips them)
    if (tweet.tweetType === "retweet") continue;

    // Dedup check
    const existing = await db.query.tweets.findFirst({
      where: eq(tweets.tweetId, tweet.tweetId),
      columns: { id: true },
    });

    if (existing) {
      dupeCount++;
      continue;
    }

    // Use account's twitterId as authorId fallback if API didn't return one
    const authorId = tweet.authorId || accountRow.twitterId || "";

    const canonical: CanonicalTweet = {
      tweet_id: tweet.tweetId,
      author_id: authorId,
      content: tweet.content,
      posted_at: tweet.postedAt.toISOString(),
      media_urls: [...tweet.mediaUrls].sort(),
      tweet_type: tweet.tweetType,
    };
    const contentHash = computeContentHash(canonical);

    const [inserted] = await db
      .insert(tweets)
      .values({
        tweetId: tweet.tweetId,
        accountId,
        authorId,
        content: tweet.content,
        rawJson: tweet,
        tweetType: tweet.tweetType,
        mediaUrls: tweet.mediaUrls,
        engagement: tweet.engagement,
        postedAt: tweet.postedAt,
        contentHash,
      })
      .returning({ id: tweets.id });

    newCount++;

    // Queue HCS attestation
    if (hcsQueue && !NO_HCS) {
      await hcsQueue.add(`hcs:${tweet.tweetId}`, {
        dbId: inserted.id,
        tweetId: tweet.tweetId,
        authorId,
        contentHash,
        type: "tweet_attestation",
        username,
        postedAt: tweet.postedAt.toISOString(),
      });
    }
  }

  console.log(
    `[browser-ingest] @${username} done — ${newCount} new, ${dupeCount} already in DB`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Resolve account list
  let usernames: string[] = [];

  if (USERNAME) {
    usernames = [USERNAME.replace(/^@/, "")];
  } else if (LIST_FILE) {
    const raw = fs.readFileSync(LIST_FILE, "utf8");
    usernames = raw
      .split("\n")
      .map((l) => l.trim().replace(/^@/, ""))
      .filter((l) => l && !l.startsWith("#"));
  } else if (!LOGIN_MODE) {
    console.error("Usage: --username <handle> | --list <file> | --login");
    process.exit(1);
  }

  // Ensure profile dir exists
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  // ---------------------------------------------------------------------------
  // Pre-flight: VPN check + manual confirmation gate
  // ---------------------------------------------------------------------------

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Signal Archive — Browser Ingest");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`  Profile dir : ${PROFILE_DIR}`);
  console.log(`  Since       : ${SINCE_RAW ?? "no limit (full backfill)"}`);
  console.log(`  Mode        : ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`  HCS queue   : ${NO_HCS || DRY_RUN ? "disabled" : "enabled"}`);
  if (!LOGIN_MODE) {
    console.log(`  Accounts    : ${usernames.length} (${usernames.slice(0, 3).join(", ")}${usernames.length > 3 ? "…" : ""})`);
    console.log(`  Delay range : ${ACCOUNT_DELAY_MIN_MS / 1000}–${ACCOUNT_DELAY_MAX_MS / 1000}s between accounts`);
  }
  console.log();

  // VPN detection (read-only — only checks process list / network interfaces)
  if (!SKIP_VPN_CHECK) {
    process.stdout.write("  VPN status  : checking… ");
    const vpn = await detectVpn();
    if (vpn === null) {
      console.log("unknown (add --skip-vpn-check to suppress)");
    } else if (vpn.active) {
      console.log(`⚠️  PROTONVPN DETECTED (via ${vpn.method})`);
      console.log();
      console.log("  ⚠️  A VPN changes your IP — this removes one of your best");
      console.log("      stealth advantages (residential IP looks human).");
      console.log("      Consider turning ProtonVPN off before proceeding.");
      console.log();
    } else {
      console.log(`✓ not detected (via ${vpn.method})`);
    }
  } else {
    console.log("  VPN status  : skipped (--skip-vpn-check)");
  }

  console.log();
  await waitForEnter("  Press Enter when ready to open the browser and start… ");
  console.log();

  const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
    viewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();

  // Login mode — just open x.com and wait for the user to log in, then exit
  if (LOGIN_MODE) {
    console.log(
      "\n[browser-ingest] LOGIN MODE — log into your X account in the browser window, then close the window."
    );
    await page.goto("https://x.com/login");
    // Wait until the browser is closed
    await new Promise<void>((resolve) => browser.on("disconnected", resolve));
    console.log("[browser-ingest] Browser closed. Session saved to:", PROFILE_DIR);
    return;
  }

  // Set up DB and HCS queue
  const db = getDb();

  let hcsQueue: Queue | null = null;
  let redis: Redis | null = null;

  if (!NO_HCS && !DRY_RUN && process.env.REDIS_URL) {
    redis = new Redis(buildRedisConnection(process.env.REDIS_URL));
    hcsQueue = new Queue("hcs-submit", { connection: redis });
  } else if (!NO_HCS && !DRY_RUN) {
    console.warn("[browser-ingest] REDIS_URL not set — HCS attestations will not be queued");
  }

  // Process each account
  for (let i = 0; i < usernames.length; i++) {
    const username = usernames[i];
    try {
      await ingestAccount(username, page, hcsQueue, db);
    } catch (err) {
      console.error(`[browser-ingest] Error on @${username}:`, (err as Error).message);
    }

    // Delay between accounts (skip after last)
    if (i < usernames.length - 1) {
      const delay = randomBetween(ACCOUNT_DELAY_MIN_MS, ACCOUNT_DELAY_MAX_MS);
      console.log(
        `[browser-ingest] Waiting ${Math.round(delay / 1000)}s before next account…`
      );
      await humanizeWait(page, delay);
    }
  }

  await browser.close();

  if (redis) await redis.quit();

  console.log("\n[browser-ingest] All done.");
}

main().catch((err) => {
  console.error("[browser-ingest] Fatal:", err);
  process.exit(1);
});
