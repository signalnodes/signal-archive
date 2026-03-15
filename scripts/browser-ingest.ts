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
 *   --cdp                  Connect to an already-running Chrome via CDP instead of
 *                          launching Playwright's own browser. Useful when X blocks
 *                          the Playwright Chromium.
 *
 *                          Before running with --cdp, launch Chrome on Windows with:
 *                            chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\signal-archive-chrome"
 *                          WSL can reach it at http://localhost:9222.
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
import { execSync, spawn } from "node:child_process";
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
const USE_CDP = hasFlag("--cdp");
const CDP_URL = process.env.CDP_URL ?? "http://localhost:9222";

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

/** Timestamp prefix for log lines: [HH:MM:SS] */
function ts(): string {
  return '[' + new Date().toTimeString().slice(0, 8) + ']';
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

/**
 * In WSL2, Chrome binds to the Windows loopback (127.0.0.1) which is not the
 * same as the WSL2 VM's localhost. Derive the Windows host IP from resolv.conf
 * (the nameserver entry is always the WSL2 gateway = Windows host).
 */
function getWindowsHostCdpUrl(cdpUrl: string): string | null {
  try {
    const resolv = fs.readFileSync("/etc/resolv.conf", "utf8");
    const match = resolv.match(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
    if (!match) return null;
    const port = new URL(cdpUrl).port || "9222";
    return `http://${match[1]}:${port}`;
  } catch {
    return null;
  }
}

async function probeCdp(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/json/version`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ensure Chrome is running with CDP.
 * Returns the reachable CDP URL (may differ from cdpUrl in WSL2 due to host routing).
 * Launches Chrome automatically if it's not running.
 */
async function ensureCdpChrome(cdpUrl: string): Promise<{ url: string; launched: boolean }> {
  const windowsHostUrl = getWindowsHostCdpUrl(cdpUrl);

  // Try localhost first, then Windows host IP (WSL2 routing fallback)
  if (await probeCdp(cdpUrl)) return { url: cdpUrl, launched: false };
  if (windowsHostUrl && await probeCdp(windowsHostUrl)) {
    console.log(`[browser-ingest] Reached Chrome via Windows host IP (${windowsHostUrl})`);
    return { url: windowsHostUrl, launched: false };
  }

  // Check if Chrome is already running WITHOUT CDP (WSL → Windows process list)
  try {
    const out = execSync("tasklist.exe /fi \"imagename eq chrome.exe\" 2>/dev/null", {
      encoding: "utf8",
      timeout: 4000,
    }).toLowerCase();
    if (out.includes("chrome.exe")) {
      throw new Error(
        "\n  Chrome is already open but was NOT started with --remote-debugging-port=9222.\n" +
        "  Close all Chrome windows, then run this script again.\n" +
        "  The script will relaunch Chrome automatically with the right flags.\n"
      );
    }
  } catch (e) {
    if ((e as Error).message.includes("Close all Chrome")) throw e;
  }

  // Chrome not running — auto-launch with CDP flags
  const chromePaths = [
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
    "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  ];
  const chromePath = chromePaths.find((p) => fs.existsSync(p));

  if (!chromePath) {
    throw new Error(
      "Chrome not found at standard paths.\n" +
      "Launch manually: chrome.exe --remote-debugging-port=9222 --user-data-dir=\"C:\\\\signal-archive-chrome\""
    );
  }

  console.log(`[browser-ingest] Launching Chrome with CDP…`);
  const child = spawn(chromePath, [
    "--remote-debugging-port=9222",
    "--user-data-dir=C:\\signal-archive-chrome",
    "--no-first-run",
    "--no-default-browser-check",
  ], { detached: true, stdio: "ignore" });
  child.unref();

  // Poll both URLs until Chrome is ready (up to 15s)
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await probeCdp(cdpUrl)) {
      console.log("[browser-ingest] Chrome is ready.");
      return { url: cdpUrl, launched: true };
    }
    if (windowsHostUrl && await probeCdp(windowsHostUrl)) {
      console.log(`[browser-ingest] Chrome is ready (via Windows host IP: ${windowsHostUrl})`);
      return { url: windowsHostUrl, launched: true };
    }
  }
  throw new Error(
    `Chrome launched but CDP not reachable after 15s.\n` +
    `  Tried: ${cdpUrl}${windowsHostUrl ? ` and ${windowsHostUrl}` : ""}\n` +
    `  Check: is port 9222 blocked by Windows Firewall?`
  );
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
    // X has used both "timeline_v2" and "timeline" as the key — try both
    const timelineRoot = (user?.timeline_v2 ?? user?.timeline) as Record<string, unknown>;
    const timeline = (
      timelineRoot?.timeline as Record<string, unknown>
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

        results.push({
          tweetId,
          authorId,
          content: (legacy.full_text as string) ?? "",
          postedAt,
          tweetType: detectTweetType(legacy),
          mediaUrls: extractMedia(legacy),
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

// CDP capture state — populated in main() when --cdp is active.
// Passed into ingestAccount so drainResponses can read from Node.js land
// instead of window.__xResponses (which service workers bypass).
interface CdpCapture {
  bodies: Array<Record<string, unknown>>;   // GraphQL response bodies
  endpoints: string[];                       // /graphql/ endpoint names seen
}

async function ingestAccount(
  username: string,
  page: import("playwright").Page,
  hcsQueue: Queue | null,
  db: ReturnType<typeof getDb>,
  cdpCapture?: CdpCapture
): Promise<void> {
  console.log('\n' + ts() + ' [browser-ingest] Starting @' + username);

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

  // Helper: drain captured GraphQL responses.
  // CDP mode: drains from the Node.js capturedBodies array (populated via CDP Network events).
  // Regular mode: drains from window.__xResponses (populated by the init script fetch/XHR patch).
  const drainResponses = async (): Promise<number> => {
    let bodies: Array<Record<string, unknown>>;

    if (cdpCapture) {
      // Splice in-place so we don't re-process the same response twice
      bodies = cdpCapture.bodies.splice(0);
    } else {
      const items = await page.evaluate(() => {
        const data = (window as any).__xResponses ?? [];
        (window as any).__xResponses = [];
        return data;
      });
      // Each item is { url, body } from the init script
      bodies = items.map((item: any) => item?.body ?? item);
    }

    let count = 0;
    for (const body of bodies) {
      try {
        const parsed = parseTweetsFromResponse(body);
        for (const t of parsed) {
          if (!seenIds.has(t.tweetId)) {
            seenIds.add(t.tweetId);
            collectedTweets.push(t);
            count++;
          }
        }
      } catch { /* ignore unparseable responses */ }
    }
    return count;
  };

  // Clear stale state from previous account
  if (cdpCapture) {
    cdpCapture.bodies.splice(0);
  } else {
    await page.evaluate(() => { (window as any).__xResponses = []; });
  }

  try {
    await page.goto(`https://x.com/${username}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(applyJitter(3000));

    // Diagnostic: log interceptor/capture state and inspect the first buffered response
    let debug: Record<string, unknown>;
    if (cdpCapture) {
      // CDP mode: data lives in Node.js — no page.evaluate needed
      const first = cdpCapture.bodies[0] ?? null;
      debug = {
        mode: "CDP Network events",
        graphqlEndpoints: cdpCapture.endpoints,
        responsesBuffered: cdpCapture.bodies.length,
        firstTopKeys: first ? Object.keys(first) : [],
        firstDataKeys: (first as any)?.data ? Object.keys((first as any).data) : [],
        firstDataUserKeys: (first as any)?.data?.user ? Object.keys((first as any).data.user) : [],
        firstDataUserResultKeys: (first as any)?.data?.user?.result
          ? Object.keys((first as any).data.user.result) : [],
        hasUserByScreenName: !!(first as any)?.data?.user_by_screen_name,
      };
    } else {
      // Regular Playwright mode: data lives in window.__xResponses
      debug = await page.evaluate(() => {
        const responses: any[] = (window as any).__xResponses ?? [];
        const graphqlUrls: string[] = (window as any).__xGraphqlUrls ?? [];
        const firstItem = responses[0];
        const first = firstItem?.body ?? firstItem;
        return {
          mode: "init-script (fetch/XHR patch)",
          interceptorReady: !!(window as any).__xInterceptorReady,
          responsesBuffered: responses.length,
          fetchCalls: (window as any).__fetchCallCount ?? 0,
          xhrCalls: (window as any).__xhrCallCount ?? 0,
          graphqlEndpoints: graphqlUrls,
          firstTopKeys: first ? Object.keys(first) : [],
          firstDataKeys: first?.data ? Object.keys(first.data) : [],
          firstDataUserKeys: first?.data?.user ? Object.keys(first.data.user) : [],
          firstDataUserResultKeys: first?.data?.user?.result
            ? Object.keys(first.data.user.result) : [],
          hasUserByScreenName: !!(first?.data?.user_by_screen_name),
        };
      });
    }
    console.log(`[browser-ingest] Debug: ${JSON.stringify(debug, null, 2)}`);

    // Collect tweets that loaded during the initial page load
    const initialCount = await drainResponses();
    if (initialCount > 0) {
      process.stdout.write(`  intercepted ${initialCount} tweets from initial load (total: ${collectedTweets.length})\r`);
    }

    // Scroll loop
    while (scrollCount < MAX_SCROLLS && !hitCutoff) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 3));
      await page.waitForTimeout(applyJitter(SCROLL_DELAY_MS));

      const newThisScroll = await drainResponses();
      scrollCount++;

      if (newThisScroll === 0) {
        emptyScrollCount++;
        if (emptyScrollCount >= MAX_EMPTY_SCROLLS) {
          console.log(`\n[browser-ingest] No new tweets for ${MAX_EMPTY_SCROLLS} scrolls — reached end of timeline`);
          break;
        }
      } else {
        emptyScrollCount = 0;
        process.stdout.write(`  intercepted ${newThisScroll} tweets (total: ${collectedTweets.length})\r`);
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
  } finally { /* fetch interceptor lives in the page, no listener to remove */ }

  // Filter by cutoff
  const toProcess = SINCE
    ? collectedTweets.filter((t) => t.postedAt >= SINCE)
    : collectedTweets;

  console.log('\n' + ts() + ' [browser-ingest] @' + username + ': ' + collectedTweets.length + ' scraped, ' + toProcess.length + ' within date range');

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

  console.log(ts() + ' [browser-ingest] @' + username + ' done — ' + newCount + ' new, ' + dupeCount + ' already in DB');
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
  if (USE_CDP) {
    console.log(`  Browser     : Windows Chrome via CDP (${CDP_URL})`);
  } else {
    console.log(`  Profile dir : ${PROFILE_DIR}`);
  }
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
  let activeCdpUrl = CDP_URL;
  if (USE_CDP) {
    const { url, launched } = await ensureCdpChrome(CDP_URL);
    activeCdpUrl = url;
    if (!launched) {
      console.log(`  Chrome (CDP) : already running at ${activeCdpUrl}`);
    } else {
      console.log(`  Chrome (CDP) : launched at ${activeCdpUrl}`);
    }
    console.log();
  } else {
    await waitForEnter("  Press Enter when ready to start… ");
  }
  console.log();

  let browser: import("playwright").BrowserContext;
  let page: import("playwright").Page;

  let cdpCapture: CdpCapture | undefined;

  if (USE_CDP) {
    // Connect to an already-running Chrome via CDP (e.g. Windows Chrome from WSL)
    const cdpBrowser = await chromium.connectOverCDP(activeCdpUrl);
    const contexts = cdpBrowser.contexts();
    browser = contexts[0] ?? await cdpBrowser.newContext();
    const pages = browser.pages();
    page = pages[0] ?? await browser.newPage();

    // In CDP mode, X's service worker handles all GraphQL requests, so
    // window.fetch/XHR patches never see the traffic. Instead we use CDP
    // Network events which fire at the browser level regardless of context.
    const cdpSession = await browser.newCDPSession(page);
    await cdpSession.send("Network.enable");

    cdpCapture = { bodies: [], endpoints: [] };
    const pendingRequests = new Map<string, string>(); // requestId → endpoint name

    cdpSession.on("Network.requestWillBeSent", (params: any) => {
      const url: string = params.request?.url ?? "";
      if (!url.includes("/graphql/")) return;
      const name = url.split("?")[0].split("/").pop() ?? url;
      if (!cdpCapture!.endpoints.includes(name)) cdpCapture!.endpoints.push(name);
      if (
        url.includes("UserTweets") ||
        url.includes("UserTweetsAndReplies") ||
        url.includes("UserTimeline")
      ) {
        pendingRequests.set(params.requestId, name);
      }
    });

    cdpSession.on("Network.loadingFinished", async (params: any) => {
      if (!pendingRequests.has(params.requestId)) return;
      const name = pendingRequests.get(params.requestId)!;
      pendingRequests.delete(params.requestId);
      try {
        const result = await cdpSession.send("Network.getResponseBody", {
          requestId: params.requestId,
        });
        const body = JSON.parse(result.body);
        cdpCapture!.bodies.push(body);
        console.log(`[cdp] Captured ${name} (${result.body.length} chars)`);
      } catch (err) {
        console.warn(`[cdp] Failed to get response body for ${name}: ${err}`);
      }
    });
  } else {
    // Launch Playwright's own Chromium with a persistent profile
    browser = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
      viewport: { width: 1280, height: 900 },
    });
    page = await browser.newPage();
  }

  // Login mode — navigate to x.com/login, let user log in, then exit
  if (LOGIN_MODE) {
    if (USE_CDP) {
      console.log("\n[browser-ingest] LOGIN MODE (CDP) — logging into X in the connected Chrome window.");
      console.log("  Log in to your dummy X account, then come back here and press Enter.");
      await page.goto("https://x.com/login");
      await waitForEnter("\n  Press Enter once you're logged in… ");
      console.log("[browser-ingest] Done. Session is saved in your Chrome profile.");
    } else {
      console.log(
        "\n[browser-ingest] LOGIN MODE — log into your X account in the browser window, then close the window."
      );
      await page.goto("https://x.com/login");
      await new Promise<void>((resolve) => browser.on("disconnected", resolve));
      console.log("[browser-ingest] Browser closed. Session saved to:", PROFILE_DIR);
    }
    return;
  }

  // In CDP mode, we use Network events (set up above) — addInitScript is not needed.
  // In regular Playwright mode, inject fetch/XHR patches to capture GraphQL responses.
  if (!USE_CDP) await page.addInitScript(() => {
    // __xResponses: array of { url, body } for matched GraphQL responses
    (window as any).__xResponses = [];
    // __xGraphqlUrls: ALL /graphql/ URLs seen (for diagnostics — helps find correct endpoint)
    (window as any).__xGraphqlUrls = [];
    (window as any).__xInterceptorReady = true;
    (window as any).__fetchCallCount = 0;
    (window as any).__xhrCallCount = 0;

    function recordGraphqlUrl(url: string) {
      // Extract just the endpoint name (after last /) for readability
      const name = url.split("?")[0].split("/").pop() ?? url;
      const seen: string[] = (window as any).__xGraphqlUrls;
      if (!seen.includes(name)) seen.push(name);
    }

    function isTweetTimeline(url: string): boolean {
      return url.includes("/graphql/") && (
        url.includes("UserTweets") ||
        url.includes("UserTweetsAndReplies") ||
        url.includes("UserTimeline")
      );
    }

    // Patch fetch
    const origFetch = window.fetch;
    window.fetch = async function (...args: any[]) {
      (window as any).__fetchCallCount++;
      const response = await origFetch.apply(this, args);
      const url: string = typeof args[0] === "string" ? args[0] : (args[0] as any)?.url ?? "";
      if (url.includes("/graphql/")) {
        recordGraphqlUrl(url);
        if (isTweetTimeline(url)) {
          response.clone().json().then((data: any) => {
            (window as any).__xResponses.push({ url, body: data });
          }).catch(() => {});
        }
      }
      return response;
    };

    // Patch XHR
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method: string, url: string, ...rest: any[]) {
      (this as any).__xUrl = url;
      return origOpen.apply(this, [method, url, ...rest] as any);
    };
    XMLHttpRequest.prototype.send = function (...args: any[]) {
      (window as any).__xhrCallCount++;
      const url: string = (this as any).__xUrl ?? "";
      if (url.includes("/graphql/")) {
        recordGraphqlUrl(url);
        if (isTweetTimeline(url)) {
          this.addEventListener("load", function () {
            try {
              const data = JSON.parse((this as any).responseText);
              (window as any).__xResponses.push({ url, body: data });
            } catch { /* not JSON */ }
          });
        }
      }
      return origSend.apply(this, args);
    };
  }); // end addInitScript (non-CDP only)

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
      await ingestAccount(username, page, hcsQueue, db, cdpCapture);
    } catch (err) {
      console.error(`[browser-ingest] Error on @${username}:`, (err as Error).message);
    }

    // Delay between accounts (skip after last)
    if (i < usernames.length - 1) {
      const delay = randomBetween(ACCOUNT_DELAY_MIN_MS, ACCOUNT_DELAY_MAX_MS);
      const resumeAt = new Date(Date.now() + delay).toTimeString().slice(0, 8);
      console.log(ts() + ' [browser-ingest] Waiting ' + Math.round(delay / 1000) + 's before next account (resumes ~' + resumeAt + ')…');
      await page.waitForTimeout(delay);
    }
  }

  // In CDP mode we connected to an existing browser — don't close it
  if (!USE_CDP) {
    await browser.close();
  }

  if (redis) await redis.quit();

  console.log("\n[browser-ingest] All done.");
}

main().catch((err) => {
  console.error("[browser-ingest] Fatal:", err);
  process.exit(1);
});
