# Browser Ingestion Lifehack
*Date: February 26, 2026*

---

## The Problem

Onboarding a new tracked account via our paid API (SocialData.tools) costs money proportional to how far back we want to go — roughly $0.0002 per request, ~20 tweets per request. A senator with 5,000 tweets costs $0.05 to backfill. That sounds cheap until you're onboarding 535 Congress members at once ($26+), plus additional accounts sourced from community suggestions on an ongoing basis. The API is also limited in how far back it can reach.

We want to grow the account list aggressively and keep costs near zero until we have funding.

---

## The Lifehack

Run a real browser on a local machine (your laptop/desktop), logged into a dummy X account. The browser scrapes tweet history by intercepting X's own internal API responses as you scroll a profile page — no third-party API needed, no per-request cost, no rate limit beyond what a human user would face.

**This is the same technique used by investigative journalists and open-source intelligence researchers.** It is not hacking — it reads public tweets that anyone with a browser can see. The dummy account follows the tracked accounts to maintain a natural-looking profile.

---

## How It Works

### Why intercept GraphQL instead of parsing the page HTML?

When you scroll a Twitter/X profile, the browser fires requests to X's internal GraphQL endpoint (`api.x.com/graphql/.../UserTweets`). These return clean, structured JSON containing full tweet data — IDs, text, timestamps, engagement counts, media URLs. Intercepting these responses gives us exactly the same structured data as a paid API, for free, without touching the DOM.

The alternative (parsing HTML/CSS selectors) is fragile — X redesigns their UI frequently and scrapers break. The GraphQL responses are more stable because they are the data layer X's own frontend depends on.

### Flow

```
Launch Chromium (real browser, not headless)
        │
        ▼
Navigate to x.com/{username}  ←── logged in as dummy account
        │
        ├── Intercept: api.x.com/graphql/.../UserTweets responses
        │       └── Parse tweet JSON → extract id, text, timestamp, media, engagement
        │
        ├── Scroll down slowly (randomized delays + mouse movements)
        │       └── X auto-loads more tweets, fires more GraphQL requests
        │
        ├── Repeat until:
        │       - Oldest tweet hits the --since date cutoff, OR
        │       - 3 consecutive scrolls return no new tweets (end of timeline), OR
        │       - Safety cap of 200 scrolls reached
        │
        └── Write all collected tweets to production Neon DB
                └── Queue HCS attestation for each new tweet → Hedera mainnet
```

### What gets skipped

- **Retweets** — we track what people say, not what they amplify. Consistent with the rest of the pipeline.
- **Already-archived tweets** — deduplication via the existing `tweet_id UNIQUE` constraint. Safe to re-run on the same account.
- **Tweets before `--since` date** — configurable cutoff, default is no limit (full backfill).

---

## Anti-Detection Measures

X actively combats automated scraping. Here's what we do to look like a human:

| Measure | Detail |
|---|---|
| **Real browser** | Playwright launches a real Chromium binary, not a headless fake. Headless Chrome has dozens of detectable fingerprint differences. |
| **Persistent profile** | The browser uses a saved profile directory. The dummy account stays logged in between runs, just like a real user. No fresh sessions that look suspicious. |
| **Residential IP** | Running on your home machine means your home IP. Datacenter IPs (Railway, AWS, etc.) are flagged heavily. Your residential IP looks like a real person browsing Twitter. |
| **Randomized mouse movements** | During every wait period, the mouse moves to random positions with randomized interpolation steps — mimics idle human cursor behavior. |
| **Jittered scroll delays** | Base 3-second scroll delay with ±30% random variance. Never a perfectly consistent rhythm. |
| **Random account delays** | Between accounts: 50–220 seconds chosen uniformly at random. Not a fixed interval, not a pattern. |
| **VPN warning** | A VPN changes your IP from residential to a datacenter/known-VPN range, which undermines the residential IP advantage. Script detects ProtonVPN before starting and warns you. |
| **Manual start gate** | Script pauses and prints a status summary before opening the browser. You press Enter to proceed — gives you a moment to confirm VPN is off and conditions are good. |

### The VPN check (important nuance)

The VPN detection is **purely read-only**. On Windows/WSL2 it runs `tasklist.exe` — the Windows equivalent of `ps aux`, a built-in OS command that just lists running processes. On Linux it checks `ip link` for VPN-related network interfaces. No settings are changed, nothing is written, no network calls are made. It warns you if ProtonVPN is detected, but you can still proceed (or pass `--skip-vpn-check` to suppress it entirely).

---

## Setup (One-Time)

**Prerequisites:** Node.js, the project repo cloned, `.env` configured with `DATABASE_URL` and `REDIS_URL`.

```bash
# 1. Download the Chromium browser (one time, ~170MB)
npx playwright install chromium

# 2. Log the dummy X account into the browser
#    (opens a browser window — log in normally, then close the window)
npx tsx --env-file=.env scripts/browser-ingest.ts --login
```

The session is saved to `~/.signal-archive-browser` (configurable via `BROWSER_PROFILE_DIR` in `.env`). You only do the login step once — the session persists indefinitely as long as X doesn't force a logout.

**The dummy account should:**
- Be a real account (not obviously fake name/handle)
- Follow all the accounts we track — this looks natural and may improve timeline visibility
- Have some normal-looking activity (a few follows, maybe a bio)
- Not be linked to your real identity or the @signalarchives account

---

## Usage

```bash
# Backfill a single account — all available history
npx tsx --env-file=.env scripts/browser-ingest.ts --username realDonaldTrump

# Backfill with a date cutoff
npx tsx --env-file=.env scripts/browser-ingest.ts --username realDonaldTrump --since 2024-01-01

# Bulk onboard from a list file (see format below)
npx tsx --env-file=.env scripts/browser-ingest.ts --list accounts.txt --since 2024-01-01

# Test run — parses and logs tweets but writes nothing to DB
npx tsx --env-file=.env scripts/browser-ingest.ts --username elonmusk --dry-run

# Write to DB but skip queuing HCS attestations (useful for very large batches
# where you want to defer the Hedera cost and queue HCS separately later)
npx tsx --env-file=.env scripts/browser-ingest.ts --list accounts.txt --no-hcs
```

### List file format (`accounts.txt`)

```
# Trump family
realDonaldTrump
DonaldJTrumpJr

# Congress
SenSanders
SenWarren
AOC
```

One username per line. `@` prefix optional. `#` lines are comments and are ignored.

---

## Pre-Flight Output (what you see before it starts)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Signal Archive — Browser Ingest
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Profile dir : /home/user/.signal-archive-browser
  Since       : 2024-01-01
  Mode        : LIVE
  HCS queue   : enabled
  Accounts    : 12 (realDonaldTrump, DonaldJTrumpJr, EricTrump…)
  Delay range : 50–220s between accounts

  VPN status  : ✓ not detected (via tasklist.exe (Windows))

  Press Enter when ready to open the browser and start…
```

---

## Important Limitations

- **Accounts must already exist in `tracked_accounts`** before running the script. Add them via the seed script first — the browser script only ingests tweets, it doesn't create account records.
- **X limits profile timelines to ~3,200 tweets** regardless of how far you scroll. This is an X-side restriction, not a script limitation.
- **Runs on your local machine only** — not deployed to Railway. Requires your laptop/desktop to be on and available. The Railway worker handles ongoing monitoring; this script is for one-time backfills and new account onboarding.
- **Not tested end-to-end yet** — the GraphQL parser is built from X's known response format but needs a real run to confirm all fields parse correctly. The `--dry-run` flag exists specifically for this: run it first to inspect what gets parsed before writing to DB.

---

## Cost Comparison

| Approach | Cost to onboard 535 Congress accounts (est. 2,000 tweets each) |
|---|---|
| SocialData API | ~$10.70 (100 requests/account × $0.0002 × 535) |
| Browser script | $0 |
| Hedera HCS (both) | ~$0.85 (1,000 new tweets × $0.0008) — same either way |

The savings grow significantly for deeper backfills (e.g., going back 3+ years).

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Dummy account gets banned | Low-Medium | Anti-detection measures above; if banned, create a new one and re-login |
| X changes GraphQL response format | Medium | Parser has fallbacks and won't crash — it'll just collect fewer tweets. Run `--dry-run` to spot issues before a big batch. |
| X detects headless/automation | Low | Using real Chromium (not headless), real profile, residential IP |
| Script runs while VPN is active | Low | Pre-flight check warns you; manual gate gives you time to turn it off |
| Duplicate tweets in DB | None | `tweet_id UNIQUE` constraint — duplicates are silently skipped |
| Overwrites good data | None | Script only inserts, never updates existing records |
