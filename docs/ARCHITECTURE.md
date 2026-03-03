# Signal Archive (TAA)

## Project Overview

A public accountability platform that monitors, records, and cryptographically attests tweets from public figures — particularly those with legal obligations to preserve public statements or patterns of deleting incriminating content. Proof of tweet existence is anchored to the Hedera Consensus Service (HCS), creating an immutable, independently verifiable record.

Live at **signalarchive.org** — Twitter **@signalarchives**

---

## MVP Scope & Priorities

### Phase 1: Trump Family & Political Crypto Deletion Tracking (COMPLETE)
- Trump family accounts, affiliated crypto project accounts (World Liberty Financial, $TRUMP, $MELANIA)
- Key political appointees known for deletion patterns (e.g., Kash Patel)
- Key cabinet, white house, and federal agency accounts
- Focus on crypto-related tweet deletions as the headline feature
- **Seeded: ~40 accounts**

### Phase 2: Government Accountability Expansion
- US Congress members (535 accounts)
- White House, agency heads, press secretaries
- Federal agency official accounts (DOJ, SEC, CFPB, etc.)
- Accounts subject to Presidential Records Act / Federal Records Act
- **Target: ~700-1000 accounts**

### Phase 3: Crypto Alpha Caller / Scam Accountability
- "Alpha callers" who delete failed predictions
- Project accounts that scrub promises
- Influencers with patterns of pump-and-dump promotion
- **Target: Community-nominated, curated list**

### Phase 4: Freemium Public Platform
- Public can request accounts to be tracked
- Paid tier for expedited tracking of qualifying accounts
- API access for journalists and researchers

---

## System Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           SIGNAL ARCHIVE                             │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────────┐     │
│  │   Ingestion   │───▶│  PostgreSQL   │───▶│  HCS Attestation   │     │
│  │    Worker     │    │   (Neon)      │    │     Service         │     │
│  └──────────────┘    └──────┬───────┘    └────────────────────┘     │
│                             │                                        │
│  ┌──────────────┐           │            ┌────────────────────┐     │
│  │   Deletion    │───────▶──┤            │   Hedera Consensus  │     │
│  │   Detection   │          │            │   Service (Mainnet)  │     │
│  │    Worker     │          │            │   Topic 0.0.10301350│     │
│  └──────────────┘           │            └────────────────────┘     │
│                             │                                        │
│  ┌──────────────────────────┴──────────────────────────────────┐    │
│  │                     Web Portal (Next.js)                      │    │
│  │  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │    │
│  │  │  Search   │  │  Account     │  │  Deletion Feed /      │  │    │
│  │  │  & Filter │  │  Profiles    │  │  Alert Dashboard      │  │    │
│  │  └──────────┘  └──────────────┘  └───────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Backend / Services
| Component | Technology | Notes |
|-----------|-----------|-------|
| Runtime | **Node.js (TypeScript)** | Hedera SDK is JS-native |
| Database | **PostgreSQL 16** (Neon) | Full-text search, JSONB, managed |
| ORM | **Drizzle ORM** | Type-safe, migrations |
| Job Scheduling | **BullMQ + Redis** (Upstash) | Repeatable jobs for ingestion, deletion checks, HCS |
| Build | **tsup** (CJS bundle) | Worker bundled for Railway deployment |

### Frontend
| Component | Technology | Notes |
|-----------|-----------|-------|
| Framework | **Next.js 14+ (App Router)** | SSR for SEO, API routes |
| Styling | **Tailwind CSS v4** | shadcn/ui components |
| Search | **PostgreSQL full-text search** | Supports phrases, exclusions, `from:username` |

### Blockchain / Attestation
| Component | Technology | Notes |
|-----------|-----------|-------|
| Consensus Layer | **Hedera Consensus Service (HCS)** | Immutable timestamped proof, ~$0.0008/msg |
| Hedera SDK | **@hashgraph/sdk** | Official JS SDK |
| Hash Algorithm | **SHA-256** | Deterministic canonical JSON |

### Infrastructure (Live)
| Component | Provider | Plan |
|-----------|---------|------|
| Web frontend | Railway | Hobby (~$5/mo) |
| BullMQ worker | Railway | Hobby (~$5/mo) |
| PostgreSQL | Neon | Free tier (pooled URL for web, direct for worker/migrations) |
| Redis | Upstash | Free tier (TLS — `rediss://` URL) |
| Blockchain | Hedera Mainnet | Pay-per-use |
| CDN / DNS | Cloudflare | Free |

**Estimated monthly cost: ~$15-25** (Railway + Hedera fees; everything else free tier)

---

## Database Schema (PostgreSQL)

### Core Tables

```sql
-- Tracked accounts
CREATE TABLE tracked_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twitter_id      TEXT UNIQUE NOT NULL,          -- X/Twitter numeric ID (stable; handles change)
    username        TEXT NOT NULL,                  -- Current handle
    display_name    TEXT,
    category        TEXT NOT NULL,                  -- 'trump_family', 'congress', 'wlfi', etc.
    subcategory     TEXT,
    tracking_tier   TEXT DEFAULT 'standard',        -- 'priority' (30min), 'standard' (2hr), 'low' (6hr)
    is_active       BOOLEAN DEFAULT true,
    metadata        JSONB,                          -- Extensible: trackingMode, party, state, etc.
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Archived tweets
CREATE TABLE tweets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id        TEXT UNIQUE NOT NULL,           -- X/Twitter tweet ID
    account_id      UUID REFERENCES tracked_accounts(id),
    author_id       TEXT NOT NULL,                  -- Twitter user ID
    content         TEXT NOT NULL,                  -- Full tweet text
    raw_json        JSONB NOT NULL,                 -- Complete API / scrape response
    tweet_type      TEXT DEFAULT 'tweet',           -- 'tweet', 'reply', 'retweet', 'quote'
    media_urls      TEXT[],
    engagement      JSONB,                          -- DEPRECATED: column exists, never written to
    posted_at       TIMESTAMPTZ NOT NULL,
    captured_at     TIMESTAMPTZ DEFAULT now(),
    content_hash    TEXT NOT NULL,                  -- SHA-256 of canonical JSON
    is_deleted      BOOLEAN DEFAULT false,
    deleted_at      TIMESTAMPTZ,
    deletion_detected_at TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Full-text search index
CREATE INDEX idx_tweets_fts ON tweets USING GIN (to_tsvector('english', content));
CREATE INDEX idx_tweets_account ON tweets (account_id);
CREATE INDEX idx_tweets_posted ON tweets (posted_at DESC);
CREATE INDEX idx_tweets_content_hash ON tweets (content_hash);

-- HCS attestation records
CREATE TABLE hcs_attestations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id        UUID REFERENCES tweets(id),
    topic_id        TEXT NOT NULL,                  -- HCS Topic ID
    sequence_number BIGINT NOT NULL,               -- HCS message sequence number
    transaction_id  TEXT NOT NULL,                  -- Hedera transaction ID
    content_hash    TEXT NOT NULL,                  -- SHA-256 hash submitted to HCS
    consensus_timestamp TIMESTAMPTZ NOT NULL,
    message_payload JSONB,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_hcs_tweet ON hcs_attestations (tweet_id);

-- Deletion events
CREATE TABLE deletion_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id        UUID REFERENCES tweets(id),
    account_id      UUID REFERENCES tracked_accounts(id),
    detected_at     TIMESTAMPTZ DEFAULT now(),
    tweet_age_hours NUMERIC,
    content_preview TEXT,                           -- First 280 chars for quick display
    category_tags   TEXT[],
    severity_score  INTEGER,                        -- 1-10 (future: AI-assessed)
    hcs_proof_txn   TEXT,
    metadata        JSONB
);

CREATE INDEX idx_deletions_account ON deletion_events (account_id, detected_at DESC);
CREATE INDEX idx_deletions_severity ON deletion_events (severity_score DESC);
```

**Additional tables:**

```sql
-- Supporters (donors who have met the minimum threshold)
CREATE TABLE supporters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address  TEXT UNIQUE NOT NULL,   -- Hedera account ID e.g. 0.0.XXXXX
    total_donated_usd NUMERIC(12,2) DEFAULT 0,
    first_donation_at TIMESTAMPTZ NOT NULL,
    last_donation_at  TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Donor-only tracked crypto wallets (Wallet Watch)
CREATE TABLE tracked_wallets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address     TEXT NOT NULL,
    chain       TEXT NOT NULL,      -- "hedera" | "ethereum" | "solana" etc.
    label       TEXT NOT NULL,      -- display name
    category    TEXT NOT NULL,      -- "scammer" | "person_of_interest" etc.
    notes       TEXT,
    explorer_url TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);
```

**Schema additions:**
- `tracked_accounts.donor_only BOOLEAN DEFAULT false` — excludes account from public /accounts grid; included in /research for supporters only

**Supporter gating:**
- Minimum donation to qualify: **50 HBAR** or **5 USDC** per transaction
- Supporter status checked via in-process cache (`apps/web/lib/supporter-cache.ts`) — 1hr TTL for supporters, 60s for non-supporters
- API routes `/api/research/wallets` and `/api/research/accounts` verify supporter status server-side via wallet address query param

> **Note:** An `engagement_snapshots` table exists in the schema file but is not populated and is not used. It is effectively abandoned.

---

## Service Architecture Details

### 1. Tweet Ingestion Agent

**Primary data source: [SocialData.tools](https://api.socialdata.tools) REST API**
- `GET /twitter/user/{user_id}/tweets-and-replies` — fetches recent tweets per account
- Response format mirrors Twitter v1.1 (`id_str`, `full_text`, `tweet_created_at`)
- Cost: ~$0.0002/request, shared 120 req/min rate limit
- Retweets are skipped — we track what people say, not what they amplify

**Legacy fallback: Stagehand browser automation**
- Used only if `SOCIALDATA_API_KEY` is not set and `ANTHROPIC_API_KEY` is present
- Navigates to `x.com/[username]`, scrolls 3x, extracts visible tweets via AI
- Not recommended for production — slower, higher cost, more fragile

**Local backfill: `scripts/browser-ingest.ts`**
- Playwright + persistent Chromium profile (real authenticated X account)
- Intercepts X's internal `UserTweets` GraphQL API — no DOM parsing
- Used to backfill historical tweets without API cost
- See `docs/BROWSER_INGESTION_LIFEHACK.md`

**Responsibilities:**
- Poll tracked accounts for new tweets on a configurable schedule
- Compute SHA-256 hash of canonical JSON representation
- Insert into PostgreSQL
- Queue HCS attestation job
- Queue media archival job (if media present)

**Scheduling Tiers:**
| Tier | Interval | Accounts |
|------|----------|----------|
| Priority | Every 30 minutes | Trump family, active controversy accounts |
| Standard | Every 2 hours | General political, agency accounts |
| Low | Every 6 hours | Lower-priority tracked accounts |

**Canonical JSON for Hashing:**
```typescript
interface CanonicalTweet {
  tweet_id: string;
  author_id: string;
  content: string;
  posted_at: string;        // ISO 8601
  media_urls: string[];     // Sorted alphabetically
  tweet_type: string;
}
```

Keys are sorted deterministically before SHA-256 hashing. This hash is independently reproducible by anyone with the tweet data.

**Key Design Decisions:**
- Use Twitter numeric user IDs (not handles) as the stable identifier — handles change
- Store raw API response in `raw_json` for future-proofing
- Hash from a canonical subset (not raw response) so hash is reproducible from public data
- Engagement counts (likes/retweets/views) are intentionally excluded — they fluctuate and are not part of the attested canonical record

### 2. HCS Attestation Service

**Topic Structure:**
- Public tweet attestations: `0.0.10301350` (Hedera Mainnet) — created via `scripts/create-hcs-topic.ts`
- Research attestations: `0.0.10307943` (Hedera Mainnet) — created via `scripts/create-research-topic.ts`
  - Types: `wallet_flagged` (wallet watch additions), `account_flagged` (donor-only account additions)
- Both topics: submit-key locked to operator key, read-only to the public via HashScan

**Message Format (submitted to HCS):**
```json
{
  "version": "1.0",
  "type": "tweet_attestation",
  "tweet_id": "1893456789012345678",
  "author_id": "123456789",
  "content_hash": "a1b2c3d4e5f6...",
  "captured_at": "2026-02-24T15:30:00Z",
  "posted_at": "2026-02-24T14:00:00Z",
  "username": "realDonaldTrump"
}
```

**Verification Flow (for any third party):**
1. Get tweet content from Signal Archive (or reconstruct from tweet_id, author_id, content, posted_at, media_urls, tweet_type)
2. Compute `SHA-256(canonical_json(tweet))`
3. Look up HCS message by topic + sequence number on HashScan
4. Compare hash from step 2 with `content_hash` in HCS message
5. If match → tweet data is proven authentic and unaltered since `consensus_timestamp`

**Deletion Attestation:**
When a deletion is detected, submit a second HCS message:
```json
{
  "version": "1.0",
  "type": "deletion_detected",
  "tweet_id": "1893456789012345678",
  "original_hash": "a1b2c3d4e5f6...",
  "detected_at": "2026-02-25T10:00:00Z",
  "tweet_age_hours": 20.0
}
```

### 3. Deletion Detection Agent

**Primary: SocialData.tools API**
- `GET /twitter/tweets/{id}` — returns 404 when tweet is deleted
- Conservative: HTTP 403 (private) / 5xx → assume tweet exists; only 404 → mark deleted
- Token-bucket rate limiter (120 req/min shared limit)

**Approach:**
- BullMQ scheduled job runs every 15 minutes
- For each tracked account, checks non-deleted tweets from the last N days
- On 404: mark `is_deleted = true`, create `deletion_event`, queue HCS deletion attestation

**Age-based Check Frequency:**
| Tweet Age | Check Frequency |
|-----------|----------------|
| < 7 days | Every cycle |
| 7-30 days | Every 4th cycle |
| 30-90 days | Every 12th cycle |
| > 90 days | Skipped (cost control) |

### 4. Web Portal (Next.js)

**Routes:**

| Route | Description |
|-------|-------------|
| `/` | Landing page — recent notable deletions, stats, mission statement |
| `/accounts` | Grid of tracked accounts — category filter, live text search (donor_only accounts excluded) |
| `/accounts/[username]` | Account profile — ReceiptCard, 5-tab interface (Activity, Statements, Deletions, Identity, Attestations) |
| `/deletions` | Deletion feed — filterable by category, reverse chronological, paginated |
| `/tweet/[id]` | Individual tweet — content, HCS proof panel, meta panel |
| `/verify/[hash]` | Public verification — enter any SHA-256 hash, shows Hedera attestation + HashScan link |
| `/search` | Full-text search — supports `"exact phrase"`, `-exclude`, `from:username` |
| `/about` | Mission, methodology, transparency section (HCS topic ID, HashScan link) |
| `/support` | Donation page — "what you unlock" section + DonationCard. `/donate` 301-redirects here. |
| `/research` | Supporter-gated — Wallet Watch table + donor-only account grid. Client-side gate via useWallet isSupporter. |
| `/rss.xml` | RSS 2.0 feed — last 50 deletions, 15-min cache |
| `/sitemap.xml` | Dynamic sitemap — all accounts + all tweets |

**Account Profile — Tracking Modes:**

Accounts have a `trackingMode` derived from `metadata.trackingMode` JSONB field (defaults to `"FULL_ARCHIVE"`):

- **`FULL_ARCHIVE`**: All 5 tabs active. Shows tweet/deletion counts and statistics.
- **`IDENTITY_ONLY`**: Statements and Deletions tabs are visibly disabled (muted, not clickable). Activity, Identity, and Attestations tabs remain active. No tweet/deletion counts shown.

> **UX requirement:** IDENTITY_ONLY accounts must look intentional — disabled tabs must clearly communicate "not available for this account type," not appear broken or empty. Use muted styling + tooltip explaining why. Never show a loading spinner that never resolves.

**Key UI Components:**
- `ReceiptCard` — screenshotable citation block: handle, stable numeric ID, tracking mode badge, coverage summary, "View latest proof" link
- `AccountSegmentedControl` — 5-tab control, mode-aware enable/disable
- `ActivityFeed` — unified event stream (statements + deletions + attestations), MVP snapshot model (JS-level merge, no SQL UNION)
- `HcsProofPanel` — verified/pending attestation display with HashScan link
- `TweetCard` — tweet with type badge, DELETED badge, proof link (no engagement counts)
- `LetterAvatar` — deterministic color from username
- `Timestamp` — relative time, updates every 60s, absolute on hover
- `CopyButton` — clipboard copy with 2s feedback

---

## Twitter/X Data Access Strategy

### Current X API Landscape (as of Feb 2026)

- **Free tier**: Write-only, ~500 posts/month, almost no read access
- **Basic tier ($100-200/mo)**: ~10K-15K tweets/month read, 7-day search window only
- **Pro tier ($5,000/mo)**: ~1M tweets/month read, full archive search

**Decision: Use SocialData.tools as primary.** It mirrors the Twitter v1 API format and is significantly cheaper than official API access for our volume. Browser automation remains a fallback and for local backfill.

### Anti-Detection Strategy

All polling intervals have ±30% jitter applied. The browser-ingest script uses:
- Real Chromium (not headless) with persistent profile
- Randomized mouse movements and scroll delays
- Random 50-220 second delay between accounts
- Pre-flight VPN check

---

## Hedera Integration

### Setup
- Topic created via `scripts/create-hcs-topic.ts` — one-time setup
- Topic ID: `0.0.10301350` (Hedera Mainnet)
- Submit-key locked to operator key; topic is publicly readable

### Cost
| Volume | Monthly HCS Cost |
|--------|-----------------|
| 10,000 attestations/mo | ~$8.00 |
| 100,000 attestations/mo | ~$80.00 |

At Phase 1 volume (~40 accounts, ~30-minute intervals) actual cost is < $5/mo.

---

## Job Queue Architecture (BullMQ)

### Queues

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| `ingestion:priority` | Poll priority accounts every 30 min | 3 workers |
| `ingestion:standard` | Poll standard accounts every 2 hours | 5 workers |
| `ingestion:low` | Poll low-priority accounts every 6 hours | 2 workers |
| `deletion-check` | Batch deletion verification every 15 min | 2 workers |
| `hcs-submit` | Submit attestations to HCS | 1 worker (sequential) |
| `media-archive` | Download and store tweet media | 3 workers (stub — not consuming) |

---

## Monorepo Structure

```
signal-archive/
├── apps/
│   ├── web/                    # Next.js frontend + API routes
│   │   ├── app/
│   │   │   ├── page.tsx        # Landing page
│   │   │   ├── accounts/
│   │   │   ├── deletions/
│   │   │   ├── tweet/[id]/
│   │   │   ├── verify/[hash]/
│   │   │   ├── search/
│   │   │   └── api/
│   │   └── components/
│   └── worker/                 # BullMQ job consumers
│       ├── jobs/
│       │   ├── ingest.ts
│       │   ├── check-deletions.ts
│       │   ├── submit-hcs.ts
│       │   └── archive-media.ts
│       └── services/
│           ├── scraper.ts          # TweetProvider interface + Stagehand fallback
│           ├── socialdata-provider.ts  # Primary: SocialData.tools API
│           ├── mock-provider.ts    # Dev/test only
│           ├── rate-limiter.ts
│           └── hedera.ts
├── packages/
│   ├── db/                     # Drizzle schema + migrations
│   │   └── src/schema/
│   │       ├── tweets.ts
│   │       ├── tracked-accounts.ts
│   │       ├── hcs-attestations.ts
│   │       └── deletion-events.ts
│   └── shared/                 # Types, canonical hash utils, constants
├── scripts/
│   ├── seed-accounts.ts        # Bulk load tracked accounts
│   ├── browser-ingest.ts       # Local Playwright backfill (no API cost)
│   ├── backfill-mainnet-attestations.ts
│   ├── create-hcs-topic.ts
│   ├── lookup-twitter-ids.ts
│   └── update-twitter-ids.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SEED_ACCOUNTS.md
│   ├── BROWSER_INGESTION_LIFEHACK.md
│   └── REFACTOR_ASSESSMENT.md
└── turbo.json
```

---

## Deployment Architecture

```
Railway
├── web service    (Next.js, npm run start -w apps/web)
└── worker service (tsup CJS bundle, node dist/index.js)

External services:
├── Neon Postgres   (pooled URL for web, direct URL for worker + migrations)
├── Upstash Redis   (rediss:// TLS — ioredis URL parsed manually, not via constructor opts)
├── Hedera Mainnet  (HCS topic 0.0.10301350)
└── Cloudflare      (DNS, SSL proxy)
```

**Monorepo build on Railway:**
- Build: `npx turbo build --filter=@taa/web` (or `@taa/worker`)
- Start web: `npm run start -w apps/web`
- Start worker: `node apps/worker/dist/index.js`

---

## Security

- `.env` is gitignored, never committed
- `.env.example` committed with blank values — all keys documented
- Hedera operator key: ED25519, stored in Railway env vars only
- HCS submit-key locked — only operator can write to the topic
- No user accounts or auth on the public site (read-only)
- SocialData API key: Railway env only
- Database credentials: Railway env only

---

## Key Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| X bot detection | SocialData.tools API (server-to-server, no browser); browser-ingest uses real Chromium + anti-detection measures |
| SocialData goes down | Stagehand browser automation fallback; browser-ingest for manual recovery |
| Hedera network issues | BullMQ retry logic; content hashes stored locally regardless |
| Legal challenges | Public interest defense; only track public statements from public figures |
| Database growth | Age-based deletion check frequency; ARCHIVE_SINCE cutoff on ingestion |
| False deletion detection | Only flag on HTTP 404; 403/5xx treated as alive |

---

## What's Not Built Yet

| Item | Priority |
|------|----------|
| Twitter/X bot auto-posting deletions | High — biggest growth lever |
| Mass deletion event detection | High — newsworthy, automatic flagging |
| Research: admin scripts to add wallets + donor-only accounts (with HCS attestation to `0.0.10307943`) | High — research topic exists but nothing writes to it yet |
| Fix donation verify flow — donations not recording to DB in production | High — supporters table only populated manually for now |
| Media archival to Cloudflare R2 | Medium — images die when tweets deleted |
| Phase 2: Congress bulk onboarding (~535 accounts) | Medium |
| Worker health monitoring (Better Stack) | Medium |
| AI severity scoring | Phase 3 |
| Freemium / API for journalists | Phase 4 |
