# Signal Archive — Project Status Review
*Date: February 26, 2026*

---

## What It Is

A public accountability platform that monitors Twitter/X accounts of public figures, archives their tweets, and cryptographically attests each one to the Hedera blockchain. If a tweet gets deleted, there's an immutable, independently verifiable record that it existed. Live at **signalarchive.org**, Twitter **@signalarchives**.

---

## Infrastructure (Live)

| Service | Provider | Plan | Purpose |
|---|---|---|---|
| Web frontend | Railway | Hobby (~$5/mo) | Next.js app |
| Worker | Railway | Hobby (~$5/mo) | BullMQ job processor |
| PostgreSQL | Neon | Free tier | All data storage |
| Redis | Upstash | Free tier | Job queue (BullMQ) |
| Blockchain | Hedera Mainnet | Pay-per-use | Tweet attestation |
| DNS / CDN | Cloudflare | Free | DNS, SSL proxy |
| Domain | — | ~$12/yr | signalarchive.org |
| Source control | GitHub | Free (private) | github.com/signalnodes/signal-archive |

**Estimated monthly cost: ~$15-25** (Railway + Hedera fees, everything else free tier)

---

## Tech Stack

- **Frontend**: Next.js 14 App Router, Tailwind CSS v4, shadcn/ui components
- **Backend**: TypeScript, Node.js
- **Database**: PostgreSQL 16 via Drizzle ORM — full-text search, JSONB
- **Job Queue**: BullMQ + Redis
- **Blockchain**: Hedera Consensus Service (`@hashgraph/sdk`)
- **Tweet Data**: SocialData.tools REST API (~$0.0002/request)
- **Monorepo**: npm workspaces + Turborepo

**Packages:**
- `apps/web` — Next.js frontend + API routes
- `apps/worker` — BullMQ job consumers
- `packages/db` — Drizzle schema + migrations
- `packages/shared` — canonical hash, types, constants, env validation

---

## Database Schema (4 core tables)

- **`tracked_accounts`** — username, twitter_id (stable numeric ID), category, tracking_tier, is_active
- **`tweets`** — tweet_id, content, raw_json, content_hash (SHA-256), posted_at, captured_at, is_deleted, account_id, author_id, media_urls, engagement (JSONB)
- **`hcs_attestations`** — transaction_id, topic_id, sequence_number, consensus_timestamp, content_hash — linked 1:1 to tweets
- **`deletion_events`** — detected_at, tweet_age_hours, content_preview, severity_score — created when a tweet disappears

---

## Data Pipeline

```
SocialData API
     │
     ▼
Ingestion Job  →  Hash (SHA-256)  →  PostgreSQL  →  HCS Submit Queue
                                                           │
                                                           ▼
                                               Hedera Mainnet Topic
                                               0.0.10301350 (submit-key locked)

Deletion Checker  →  SocialData API (tweet ID lookup)
     │  404 = deleted
     ▼
deletion_events table  →  mark tweet is_deleted=true  →  HCS deletion attestation
```

**Hashing:** Canonical JSON of `{tweet_id, author_id, content, posted_at, media_urls[], tweet_type}` with keys sorted deterministically → SHA-256. This hash is what gets attested on-chain and is independently reproducible by anyone with the tweet data.

**HCS topic:** `0.0.10301350` on Hedera mainnet. Submit-key locked — only the operator key can write. ~$0.0008/message. 456 tweets currently attested.

---

## Worker Jobs (BullMQ)

| Queue | Schedule | What it does |
|---|---|---|
| `ingestion-priority` | Every 30 min | Poll priority accounts (Trump family etc.) |
| `ingestion-standard` | Every 2 hrs | Poll standard accounts |
| `ingestion-low` | Every 6 hrs | Poll low-priority accounts |
| `deletion-check` | Every 15 min | Check all non-deleted tweets via SocialData API |
| `hcs-submit` | On-demand | Submit attestation to Hedera |
| `media-archive` | On-demand | Queued but not yet consuming (stub) |

**Deletion check logic:** Tweets < 7 days old checked every cycle. 7-30 days: every 4th cycle. 30-90 days: every 12th cycle. >90 days: skipped. 404 response = deleted, anything else (403, 5xx) = assumed alive.

**Anti-abuse:** All intervals have ±30% jitter. SocialData has a shared 120 req/min rate limit with a token-bucket rate limiter in the worker.

---

## Frontend — All Pages

| Route | Description |
|---|---|
| `/` | Homepage — hero, 3 stat cards (archived/deletions/accounts), recent deletions feed |
| `/accounts` | Grid of all tracked accounts — category filter buttons, live text search by username/display name |
| `/accounts/[username]` | Profile — letter avatar, @handle, display name, category/tier badges, 3 stats (archived / deleted / deletion rate %), tabbed tweet list + deletion list with counts |
| `/deletions` | Full deletion feed — reverse chronological, category filter pills, paginated 25/page |
| `/tweet/[id]` | Individual tweet — full content, HCS proof panel (VERIFIED / pending), meta panel (posted/captured/hash/deletion info) |
| `/verify/[hash]` | Public verification — enter any SHA-256 hash, shows match + Hedera attestation with HashScan link |
| `/search` | Full-text search (Postgres FTS) — supports `"exact phrase"`, `-exclude`, `from:username` syntax with dismissable chip |
| `/about` | Mission, methodology, transparency section with live topic ID and HashScan link |
| `/rss.xml` | RSS 2.0 feed — last 50 deletions, 15-min cache |
| `/sitemap.xml` | Dynamic sitemap — all accounts + all tweets, deleted tweets priority 0.9 |
| `/robots.txt` | Allow all, disallow /api/, easter egg comment for humans |

**Header:** sticky, has live indicator popover showing monitored account count (hover desktop / tap mobile). Nav: Deletions / Search / Accounts / Verify / About.

**Footer:** brand tagline, About link, Hedera attribution, RSS link, Twitter bird icon → @signalarchives.

**Open Graph:** dynamic OG images for tweet pages (content + DELETED/ARCHIVED badge) and account pages (username, category, tweet/deletion counts). Default site OG image. Twitter card: `summary_large_image`.

---

## UI Components (Notable)

- **`LetterAvatar`** — deterministic color from username char sum, used on account profile, accounts grid, deletion feed cards
- **`Timestamp`** — client component, shows relative time (updates every 60s), absolute on hover
- **`LiveIndicator`** — client component, popover with monitored account count
- **`CopyButton`** — copy to clipboard, 2s "copied ✓" feedback, execCommand fallback
- **`HcsProofPanel`** — verified/pending attestation display with HashScan link
- **`TweetCard`** — tweet with engagement, DELETED badge, proof link
- **`DeletionCard`** — red left-border accent, avatar, content preview, age, proof link

---

## Tracked Accounts (Phase 1)

~50 accounts across categories:
- **trump_family** — realDonaldTrump, MELANIATRUMP, EricTrump, DonaldJTrumpJr, IvankaTrump, TiffanyATrump, BarronTrump, JaredKushner, LaraLeaTrump
- **wlfi** — World Liberty Financial principals, ZachWitkoff, StephenM
- **political_appointee** — KashPatel, SenatorHagerty, and others
- **white_house / federal_agency** — key cabinet and agency accounts
- **crypto_industry** — relevant crypto project accounts

All accounts have verified numeric Twitter IDs (not just handles, since handles can change).

---

## Operational Scripts

| Script | Usage |
|---|---|
| `scripts/seed-accounts.ts` | Bulk-insert tracked accounts into DB |
| `scripts/browser-ingest.ts` | Local browser-based backfill — no API cost |
| `scripts/backfill-mainnet-attestations.ts` | One-time: attest all existing tweets to mainnet HCS |
| `scripts/create-hcs-topic.ts` | One-time: create a new HCS topic |
| `scripts/lookup-twitter-ids.ts` | Lookup numeric Twitter IDs via SocialData |
| `scripts/update-twitter-ids.ts` | Patch wrong/missing IDs in DB |

### Browser Ingest Script

Runs locally on your machine. Uses Playwright + persistent Chromium profile (dummy X account logged in). Intercepts X's internal GraphQL `UserTweets` API responses — cleaner than DOM parsing. Writes directly to Neon DB, queues HCS to Upstash.

**Primary use cases:**
- Backfilling historical tweets for existing accounts (avoid SocialData API cost)
- Quickly onboarding large batches of new accounts

**Anti-detection features:**
- Randomized mouse movements during all waits
- Random 50–220 second delay between accounts
- ±30% jitter on scroll delays
- Real Chromium (not headless) with persistent profile
- Pre-flight VPN check — reads Windows process list via `tasklist.exe` (read-only, no settings changed) to detect ProtonVPN; warns if active since residential IP is a stealth advantage
- Manual "Press Enter to start" gate — review VPN status and abort if needed

**Usage:**
```bash
# One-time setup
npx playwright install chromium
npx tsx --env-file=.env scripts/browser-ingest.ts --login

# Backfill single account
npx tsx --env-file=.env scripts/browser-ingest.ts --username realDonaldTrump --since 2024-01-01

# Bulk onboard from list file
npx tsx --env-file=.env scripts/browser-ingest.ts --list accounts.txt --since 2024-01-01

# Test without writing anything
npx tsx --env-file=.env scripts/browser-ingest.ts --username elonmusk --dry-run
```

---

## Security

- `.env` is gitignored, never committed
- `.env.example` committed with blank values — all keys documented
- Hedera operator key: ED25519 type, stored in Railway env vars only
- HCS topic submit-key locked — only operator can write, topic is read-only to the public
- No user accounts or auth on the public site (read-only)
- SocialData API key: Railway env only
- Database credentials: Railway env only (Neon connection string)
- No secrets in Railway build logs (env vars injected at runtime)

---

## What's Not Built Yet

| Item | Priority |
|---|---|
| Twitter/X bot auto-posting deletions | High — biggest growth lever |
| Mass deletion event detection | High — newsworthy, automatic flagging |
| Media archival to Cloudflare R2 | Medium — images die when tweets deleted |
| Email/webhook alerts for deletions | Medium |
| Phase 2: Congress bulk onboarding (~535 accounts) | Medium |
| Worker health monitoring (Better Stack) | Medium |
| Homepage stats trend indicators | Deferred |
| AI severity scoring | Phase 3 |
| Freemium / API for journalists | Phase 4 |

---

## Known Gaps / Things to Audit

1. **SocialData API cost** — currently the main operational expense. Reduced by 90% already (slower intervals, smaller batches). Should track monthly spend via SocialData dashboard.
2. **Hedera wallet balance** — HCS messages cost $0.0008 each. Monitor the operator account balance periodically.
3. **Deletion checker coverage** — tweets > 90 days old are not checked. Intentional cost control, but means very old deletions won't be caught.
4. **Browser ingest script** — not yet tested end-to-end with a real X session. X's GraphQL response format could differ slightly; the parser has fallbacks but needs a real run to confirm.
5. **Twitter IDs** — 5 accounts had wrong IDs and were fixed during this session. Worth auditing the full seed list for any remaining issues.
6. **Deletions tab pagination on account profiles** — the Tweets tab is paginated (25/page), but the Deletions tab on `/accounts/[username]` currently shows up to 20 deletions with no next page. Low priority until deletions accumulate.
