# Browser Ingestion Lifehack (Internal Tool)
*Date: February 26, 2026*
*Status: Internal-only local operator tool*

---

## The Problem

Onboarding a new tracked account via our paid API (SocialData.tools) costs money proportional to how far back we want to go. That sounds cheap until we're onboarding hundreds of accounts at once, plus additional accounts sourced from community suggestions over time. The API is also limited in how far back it can reach.

We want to grow the account list aggressively and keep costs near zero until we have funding.

---

## The Lifehack

Run a real browser on a local machine (your laptop/desktop), logged into a dummy X account. The browser collects tweet history by intercepting X's own internal timeline responses as you scroll a profile page. No third-party API needed, and no per-request API cost. The dummy account should look normal and be treated as disposable if it gets challenged or suspended.

> Note: This is an internal-only operator workflow. Account enforcement is still possible even for local use, so the dummy account should not be linked to your real identity or the @signalarchives account.

---

## How It Works

### Why intercept timeline responses instead of parsing page HTML?

When you scroll a Twitter/X profile, the browser fires requests that return structured JSON containing tweet data (IDs, text, timestamps, media info). Intercepting these responses gives us clean, structured data without touching the DOM.

The alternative (parsing HTML/CSS selectors) is fragile since X redesigns their UI frequently.

### Flow

```
Launch Chromium (real browser, not headless)
        │
        ▼
Navigate to x.com/{username}  ←── logged in as dummy account
        │
        ├── Intercept timeline responses (GraphQL/internal endpoints)
        │       └── Parse tweet JSON → extract id, text, created_at, media
        │
        ├── Scroll down slowly (randomized delays + natural-ish idle behavior)
        │       └── X auto-loads more tweets, fires more timeline requests
        │
        ├── Repeat until:
        │       - Oldest tweet hits the --since date cutoff, OR
        │       - 3 consecutive scrolls return no new tweets (end of timeline), OR
        │       - Safety cap of 200 scrolls reached
        │
        └── Write collected tweets to production Neon DB
                └── Queue HCS attestation for each new tweet → Hedera mainnet
```

### What gets skipped

- **Retweets** — we track what people say, not what they amplify. Consistent with the rest of the pipeline.
- **Already-archived tweets** — deduplication via the existing `tweet_id UNIQUE` constraint. Safe to re-run on the same account.
- **Tweets before `--since` date** — configurable cutoff, default is no limit (full backfill).

---

## Anti-Detection Measures

X combats automated scraping. For internal use, we still aim to look like normal browsing:

| Measure | Detail |
|---|---|
| **Real browser** | Playwright launches a real Chromium binary (not headless). |
| **Persistent profile** | Uses a saved profile directory so the dummy account stays logged in between runs. |
| **Residential IP** | Running on your home machine uses your residential IP (datacenter IPs are more likely to be flagged). |
| **Randomized mouse movements** | Idle cursor movement during waits to avoid perfectly static behavior. |
| **Jittered scroll delays** | Base 3-second scroll delay with ±30% variance. |
| **Random account delays** | Between accounts: 50–220 seconds uniformly random. |
| **VPN warning** | Warn if VPN is detected since it can undermine the residential IP advantage. |
| **Manual start gate** | Pauses before launch so you can confirm VPN is off and conditions are good. |

### VPN check nuance

VPN detection is read-only:
- Windows/WSL2: `tasklist.exe` (lists running processes)
- Linux: `ip link` (checks network interfaces)

Nothing is changed; it only warns. You can override with `--skip-vpn-check`.

---

## Parser Resilience (Important)

This method is robust in concept, but X can change response structures over time. The main risk is silent under-collection (collecting fewer tweets) if the parser assumes a single JSON shape.

### Hardening plan

1. **Extraction accounting (always on)**
   - Log counts per account:
     - `responses_intercepted`
     - `entries_seen`
     - `tweets_extracted`
     - `skipped_retweets`
     - `skipped_non_tweet_entries` (ads, tombstones, etc.)
     - `parse_failures`
2. **Fail-soft parsing**
   - Support multiple known JSON paths for tweet objects.
   - Skip unknown entry types with a reason code (don't crash).
3. **Raw payload capture (debug mode)**
   - In `--dry-run`, or on `tweets_extracted == 0` for a response, save the raw JSON body to disk:
     - `./tmp/browser-ingest/{username}/{timestamp}-{request_id}.json`
   - This makes fixes fast when X changes shapes.
4. **Dry-run sanity preview**
   - Print a small sample (first 3 extracted tweets) with:
     - `tweet_id`, `created_at`, first 80 chars of text
   - This catches mis-parses immediately before DB writes.

---

## Setup (One-Time)

**Prerequisites:** Node.js, repo cloned, `.env` configured with `DATABASE_URL` and `REDIS_URL`.

```bash
# 1. Download Chromium (one time, ~170MB)
npx playwright install chromium

# 2. Log the dummy X account into the browser
#    (opens a browser window — log in normally, then close the window)
npx tsx --env-file=.env scripts/browser-ingest.ts --login
```

Session is saved to `~/.signal-archive-browser` (configurable via `BROWSER_PROFILE_DIR` in `.env`).

**Dummy account guidelines**
- Looks like a normal account (not obviously fake)
- Minimal human-scale activity (bio, a few follows)
- Not linked to your real identity or the @signalarchives account
- Treated as disposable if challenged/banned

---

## Usage

```bash
# Backfill a single account — all available history
npx tsx --env-file=.env scripts/browser-ingest.ts --username realDonaldTrump

# Backfill with a date cutoff
npx tsx --env-file=.env scripts/browser-ingest.ts --username realDonaldTrump --since 2024-01-01

# Bulk onboard from a list file
npx tsx --env-file=.env scripts/browser-ingest.ts --list accounts.txt --since 2024-01-01

# Test run — parses and logs tweets but writes nothing to DB
npx tsx --env-file=.env scripts/browser-ingest.ts --username elonmusk --dry-run

# Write to DB but skip queuing HCS attestations (defer Hedera cost)
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

One username per line. `@` prefix optional. `#` lines are comments and ignored.

---

## Pre-Flight Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Signal Archive - Browser Ingest
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

- **Accounts must already exist in `tracked_accounts`** before running. This script only ingests tweets.
- **X limits profile timelines to ~3,200 tweets** regardless of how far you scroll (X-side restriction).
- **Runs on your local machine only** (not deployed to Railway). Railway handles ongoing monitoring; this script is for backfills and onboarding.
- **Needs end-to-end test** — run `--dry-run` first to validate parsing before large batches.

---

## Setup Status & Next Steps (as of 2026-02-28)

### What's done

- Script fully built: `scripts/browser-ingest.ts`
- Playwright Chromium installed on WSL (`~/.cache/ms-playwright/chromium-1208`)
- `npx playwright install-deps chromium` completed (missing `libnspr4.so` fixed)
- `--cdp` flag added to script: connects to an already-running Windows browser via Chrome DevTools Protocol instead of launching Playwright's own Chromium (which X blocks immediately)
- Playwright Chromium login abandoned — X's bot detection blocks it before the password screen

### Why CDP / Windows Brave

X flags the Playwright Chromium binary hard — it won't even allow login. The solution is to use a real Windows browser (Brave or Chrome) with a fresh profile for the dummy X account, then connect to it from WSL via CDP.

### Blocked on: WSL → Windows port forwarding

CDP requires connecting to `localhost:9222` on Windows, but WSL2 can't reach Windows `127.0.0.1` directly. The fix is a one-time PowerShell (Administrator) setup:

```powershell
# Forward WSL host IP → Windows localhost for port 9222
netsh interface portproxy add v4tov4 listenport=9222 listenaddress=192.168.208.1 connectport=9222 connectaddress=127.0.0.1

# Allow it through Windows Firewall
netsh advfirewall firewall add rule name="WSL CDP 9222" dir=in action=allow protocol=TCP localport=9222
```

> `192.168.208.1` is the Windows host IP as seen from WSL on this machine. Verify with:
> `cat /etc/resolv.conf | grep nameserver | awk '{print $2}'`

### To resume — full sequence

1. Run the two `netsh` commands above in PowerShell as Administrator (one time)
2. Close all Brave windows completely
3. Launch Brave with debug port and a fresh profile:
   ```powershell
   & "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" --remote-debugging-port=9222 --user-data-dir="C:\signal-archive-chrome"
   ```
4. Confirm the port is live: open `http://localhost:9222/json` in the Brave window — should show a JSON array
5. Log into the dummy X account in that Brave window normally
6. From WSL, run login confirmation:
   ```bash
   CDP_URL=http://192.168.208.1:9222 npx tsx --env-file=.env scripts/browser-ingest.ts --login --cdp
   ```
7. Dry run to validate parser:
   ```bash
   CDP_URL=http://192.168.208.1:9222 npx tsx --env-file=.env scripts/browser-ingest.ts --username realDonaldTrump --dry-run --cdp
   ```
8. Full backfill once dry run looks good:
   ```bash
   CDP_URL=http://192.168.208.1:9222 npx tsx --env-file=.env scripts/browser-ingest.ts --list accounts.txt --since 2025-01-01 --cdp
   ```

### Notes

- The `netsh portproxy` rule persists across reboots — only need to do it once
- The Brave launch command needs to run every session (before running the script)
- Same `--user-data-dir` keeps the dummy account logged in between sessions
- VPN off during runs for residential IP advantage

---

## Cost Comparison (Placeholder)

Goal: avoid API costs where possible by using the browser method for backfills/onboarding.

> TODO: Verify SocialData pricing unit (per tweet vs per request) for the exact endpoints/plan in use, and update this section accordingly. Regardless, browser ingestion minimizes third-party backfill costs before funding.

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---:|---|
| Dummy account gets challenged/banned | Low–Medium | Treat as disposable, keep profile isolated, human-scale behavior, re-login with a new account if needed |
| Response shape changes reduce extraction | Medium | Parser resilience plan (accounting, fail-soft parsing, raw payload capture, dry-run preview) |
| Script runs while VPN is active | Low | Pre-flight warning + manual gate |
| Duplicate tweets in DB | None | `tweet_id UNIQUE` constraint; duplicates skipped |
| Overwrites data | None | Insert-only; no updates |
