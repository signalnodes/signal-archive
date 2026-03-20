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
| Job Scheduling | **BullMQ + Redis** (Railway-managed) | Repeatable jobs for ingestion, deletion checks, HCS |
| Build | **tsup** (CJS bundle) | Worker bundled for Railway deployment |

### Frontend
| Component | Technology | Notes |
|-----------|-----------|-------|
| Framework | **Next.js 16 (App Router)** | SSR for SEO, API routes |
| UI Runtime | **React 19** | |
| Styling | **Tailwind CSS v4** | shadcn/ui components |
| Search | **PostgreSQL full-text search** | Supports phrases, exclusions, `from:username` |

### Blockchain / Attestation
| Component | Technology | Notes |
|-----------|-----------|-------|
| Consensus Layer | **Hedera Consensus Service (HCS)** | Immutable timestamped proof, ~$0.0008/msg |
| Hedera SDK | **@hashgraph/sdk** | Official JS SDK |
| Hash Algorithm | **SHA-256** | Deterministic canonical JSON |

### Infrastructure (Live)
| Component | Provider | Notes |
|-----------|---------|------|
| Web frontend | Railway | Hobby (~$5/mo) |
| Worker + Ingestion | Hetzner VPS | Docker Compose stack (worker, ingest, chrome, redis) |
| PostgreSQL | Neon | Launch plan (pooled URL for web, direct for worker/migrations) |
| Redis | VPS Docker | Local container, no external dependency |
| Blockchain | Hedera Mainnet | Pay-per-use |
| CDN / DNS | Cloudflare | Free |

**Estimated monthly cost: ~$15-25** (Railway + VPS + Hedera fees)

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
    donor_only      BOOLEAN DEFAULT false,          -- Excludes from public /accounts; shown in /research for supporters
    avatar_url      TEXT,
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
    message_type    TEXT NOT NULL DEFAULT 'tweet_attestation', -- 'tweet_attestation' | 'deletion_detected'
    topic_id        TEXT NOT NULL,                  -- HCS Topic ID
    sequence_number BIGINT NOT NULL,               -- HCS message sequence number
    transaction_id  TEXT NOT NULL,                  -- Hedera transaction ID
    content_hash    TEXT NOT NULL,                  -- SHA-256 hash submitted to HCS
    consensus_timestamp TIMESTAMPTZ NOT NULL,
    message_payload JSONB,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Unique per tweet+type so deletion attestations don't conflict with tweet attestations
CREATE UNIQUE INDEX idx_hcs_tweet_type ON hcs_attestations (tweet_id, message_type);

-- Deletion events
CREATE TABLE deletion_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id        UUID NOT NULL REFERENCES tweets(id) UNIQUE, -- one deletion event per tweet
    account_id      UUID NOT NULL REFERENCES tracked_accounts(id),
    detected_at     TIMESTAMPTZ DEFAULT now(),
    tweet_age_hours NUMERIC,
    content_preview TEXT,                           -- First 280 chars for quick display
    category_tags   TEXT[],
    severity_score  INTEGER,                        -- 1-10 (AI-scored via Claude Haiku)
    metadata        JSONB
);

CREATE INDEX idx_deletions_account ON deletion_events (account_id, detected_at DESC);
CREATE INDEX idx_deletions_severity ON deletion_events (severity_score DESC);
```

**Additional tables:**

```sql
-- Individual donation records (one row per confirmed transaction)
CREATE TABLE donations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address      TEXT NOT NULL,
    transaction_id      TEXT UNIQUE NOT NULL,   -- User's transfer tx (HashScan-normalized)
    asset               TEXT NOT NULL,           -- 'hbar' | 'usdc'
    amount              NUMERIC(18,8) NOT NULL,
    amount_usd          NUMERIC(12,2),
    status              TEXT DEFAULT 'pending',  -- 'pending' | 'confirmed'
    confirmed_at        TIMESTAMPTZ,
    hbar_rate           NUMERIC(12,8),           -- Rate locked at prepare time
    template            TEXT,                    -- 'A' (HCS only) | 'B' (mint + HCS)
    badge_serial        NUMERIC(18,0),           -- NFT serial minted (Template B only)
    batch_transaction_id TEXT,                   -- Operator HIP-551 batch tx
    prepared_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- Supporters (donors who have met the minimum threshold)
CREATE TABLE supporters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address  TEXT UNIQUE NOT NULL,   -- Hedera account ID e.g. 0.0.XXXXX
    total_donated_usd NUMERIC(12,2) DEFAULT 0,
    first_donation_at TIMESTAMPTZ NOT NULL,
    last_donation_at  TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    -- NFT badge fields (HIP-551 atomic batch)
    badge_token_id  TEXT,                   -- Token ID of awarded badge (0.0.10314265)
    badge_serial    NUMERIC(18,0),          -- NFT serial number
    badge_awarded_at TIMESTAMPTZ
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

**Supporter gating:**
- Minimum donation to qualify: **100 HBAR** or **10 USDC** per transaction (≥ $10 USD at time of donation)
- Supporter status checked via in-process cache (`apps/web/lib/supporter-cache.ts`) — 1hr TTL for supporters, 60s for non-supporters
- API routes `/api/research/wallets` and `/api/research/accounts` verify supporter status server-side via wallet address query param

> **Dropped tables:** `engagement_snapshots` and `tracking_requests` were removed in migration 0006 — they had no readers or writers.

---

## Service Architecture Details

### 1. Tweet Ingestion Agent

**Primary data source: [SocialData.tools](https://api.socialdata.tools) REST API** *(optional)*
- `GET /twitter/user/{user_id}/tweets-and-replies` — fetches recent tweets per account
- Response format mirrors Twitter v1.1 (`id_str`, `full_text`, `tweet_created_at`)
- Cost: ~$0.0002/request, shared 120 req/min rate limit
- Retweets are skipped — we track what people say, not what they amplify

**Worker behavior when `SOCIALDATA_API_KEY` is missing:**
- `createProvider()` falls back to a no-op stub — ingestion jobs are skipped silently
- The worker continues to run; HCS attestation and deletion-check jobs are unaffected
- `SOCIALDATA_API_KEY` is optional; remove it from Railway env vars without consequence

**Local backfill: `scripts/browser-ingest.ts`**
- Connects to Windows Chrome via CDP (WSL2: auto-launches Chrome if not running)
- Intercepts X's internal `UserTweets` GraphQL API via CDP Network events — no DOM parsing
- Used to backfill historical tweets without API cost
- Run `scripts/check-ingest-gap.ts` first to see per-account gaps and get the exact backfill command

**Responsibilities:**
- Poll tracked accounts for new tweets on a configurable schedule
- Compute SHA-256 hash of canonical JSON representation
- Insert into PostgreSQL
- Queue HCS attestation job
- Queue media archival job (if media present)

**Scheduling Tiers:**
| Tier | Interval | Accounts |
|------|----------|----------|
| Priority | Every 1 hour | Trump family, active controversy accounts |
| Standard | Every 4 hours | General political, agency accounts |

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
  "type": "tweet_attestation",
  "tweetId": "1893456789012345678",
  "authorId": "123456789",
  "username": "realDonaldTrump",
  "postedAt": "2026-02-24T14:00:00Z",
  "contentHash": "a1b2c3d4e5f6...",
  "topicId": "0.0.10301350",
  "submittedAt": "2026-02-24T15:30:00Z"
}
```

**Verification Flow (for any third party):**
1. Get tweet content from Signal Archive (or reconstruct from tweet_id, author_id, content, posted_at, media_urls, tweet_type)
2. Compute `SHA-256(canonical_json(tweet))`
3. Look up HCS message by topic + sequence number on HashScan
4. Compare hash from step 2 with `content_hash` in HCS message
5. If match → tweet data is proven authentic and unaltered since `consensus_timestamp`

**Deletion Attestation:**
When a deletion is detected, a second HCS message is submitted with the same schema but `type: "deletion_detected"`. Both attestation and deletion records share the `hcs_attestations` table, distinguished by the `message_type` column — the unique index is on `(tweet_id, message_type)`.

### 3. Deletion Detection Agent

**Primary: [SocialData.tools](https://api.socialdata.tools) API** *(when `SOCIALDATA_API_KEY` is set)*
- `GET /twitter/tweets/{id}` — returns 404 when tweet is deleted
- Conservative: HTTP 403 (private) / 5xx → assume tweet exists; only 404 → mark deleted
- Token-bucket rate limiter (120 req/min shared limit)

**Fallback: oEmbed API** *(free, no API key required)*
- `GET https://publish.twitter.com/oembed?url=...` — 404 means deleted
- Activated automatically when `SOCIALDATA_API_KEY` is not set
- Same conservative logic: 403/5xx treated as alive, only 404 → mark deleted
- Rate limited to 60 req/min with 429 backoff

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

### 4. Donation Flow (HIP-551 Atomic Batch)

Donations are processed via a two-step server-assisted flow:

**Step 1 — `POST /api/donations/prepare`**
- Client sends `{ walletAddress, asset, amount }`
- Server locks the HBAR/USD rate (CoinGecko → mirror node fallback → stale cache → floor)
- Determines template:
  - **Template A**: `amountUsd < $10` OR donor already has a badge → batch = `[hcsTx]`
  - **Template B**: `amountUsd >= $10` AND no badge yet AND token is associated → batch = `[mintTx, hcsTx]`
- Returns `{ batchId, template, amountUsd, needsAssociation }`; if `needsAssociation: true`, user must associate the badge token first

**Step 2 — User submits transfer**
- Client builds and submits the HBAR/USDC `TransferTransaction` via WalletConnect (`signAndExecuteTransaction`)

**Step 3 — `POST /api/donations/execute`**
- Client sends `{ batchId, transferTransactionId }`
- Server verifies the transfer landed on-chain via mirror node (up to 6 retries × 3s)
- Server builds and signs the operator-only `BatchTransaction` (HIP-551)
- For Template B: mints badge NFT in the batch, then transfers it to the donor in a **separate** follow-up transaction (serials are not known at batch validation time — see critical design note below)
- NFT metadata is updated via `TokenUpdateNftsTransaction` (HIP-657 dNFT) to point to `/api/nft/{serial}`
- Records to `donations` table and upserts `supporters` table (with badge serial if Template B)
- Warms the supporter cache

**Critical design constraints:**
- NFT transfer must be outside the batch: Hedera validates all inner txs before execution, so a transfer referencing a not-yet-minted serial fails validation
- Never write `predictedSerial` to DB: only write `actualSerial` from the confirmed mint receipt, or `alreadyHasBadge()` will permanently block Template B for that wallet
- Two-party batch signing does not work with WalletConnect: operator builds/signs the batch unilaterally after verifying the user's transfer

**Badge NFT:** Token `0.0.10314265` (`SIGBADGE`) on mainnet — FINITE 500 max supply, 10% royalty + 2 HBAR fallback, all keys set to operator

### 5. Web Portal (Next.js)

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

**Decision: Use SocialData.tools as primary when available.** It mirrors the Twitter v1 API format and is significantly cheaper than official API access for our volume. The worker runs without it — SocialData is additive, not required. Browser automation (CDP) is used for manual backfills.

### Anti-Detection Strategy

All ingestion jobs apply a random 0-5s startup delay per execution. The browser-ingest script uses:
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

### Future: Immutable Topic (HIP-1139)
HIP-1139 will allow permanently disabling the admin key so the attestation topic becomes truly immutable — nobody (including the operator) can ever modify or delete it. This is a significant trust/credibility signal. **Not yet live on mainnet as of March 2026.** Plan to apply to `0.0.10301350` once the HIP lands.

### SDK Migration Note
The Hedera JS SDK is migrating from `@hashgraph/sdk` to `@hiero-ledger/sdk`. No breaking HCS changes are expected. Monitor for a migration window when the new package stabilizes.

### Cost
ConsensusSubmitMessage is priced at **$0.0008 USD per message** as of January 2026 (HIP-991, mainnet v0.69 — increased from $0.0001).

| Volume | Monthly HCS Cost |
|--------|-----------------|
| 10,000 attestations/mo | ~$8.00 |
| 100,000 attestations/mo | ~$80.00 |

At Phase 1 volume (~40 accounts, ~30-minute intervals) actual cost is < $5/mo.

### Message Size Limit
HCS messages are capped at **1 KB (1,024 bytes)** per submission. Current payloads are 220–300 bytes. If a message exceeds 1 KB, chunking per HCS-1 standard is required.

---

## Job Queue Architecture (BullMQ)

### Queues

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| `ingestion` | Poll accounts for new tweets — all tiers in one queue, differentiated by BullMQ job priority | 5 workers |
| `deletion-check` | Batch deletion verification every 15 min | 1 worker |
| `hcs-submit` | Submit attestations to HCS | 1 worker (sequential) |
| `media-archive` | Download and store tweet media | stub — not consuming |

**Ingestion queue priorities** (lower number = higher priority, set via `TIER_PRIORITIES`):
| Tier | BullMQ Priority | Interval |
|------|----------------|----------|
| priority | 1 | 1 hr (±5s per-execution jitter) |
| standard | 5 | 4 hr (±5s per-execution jitter) |

> Jitter is applied at job execution time (random 0-5s delay), not at registration time, so repeatable job intervals remain stable across worker restarts.

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
│           ├── scraper.ts                  # TweetProvider interface + provider factory
│           ├── socialdata-provider.ts      # Optional: SocialData.tools API (when API key set)
│           ├── oembed-deletion-checker.ts  # Free fallback deletion checker (no API key needed)
│           ├── mock-provider.ts            # Dev/test only
│           ├── rate-limiter.ts
│           ├── heartbeat.ts               # Better Stack heartbeat (HEARTBEAT_URL env var)
│           └── hedera.ts
├── packages/
│   ├── db/                     # Drizzle schema + migrations
│   │   └── src/schema/
│   │       ├── tweets.ts
│   │       ├── tracked-accounts.ts
│   │       ├── tracked-wallets.ts
│   │       ├── hcs-attestations.ts
│   │       ├── deletion-events.ts
│   │       ├── mass-deletion-events.ts
│   │       ├── supporters.ts
│   │       └── donations.ts
│   └── shared/                 # Types, canonical hash utils, constants
├── scripts/
│   ├── seed-accounts.ts              # Bulk load tracked accounts
│   ├── browser-ingest.ts             # CDP backfill via Windows Chrome (auto-launches if needed)
│   ├── check-ingest-gap.ts           # Diagnostic: per-account gap since last capture + backfill cmd
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
└── web service    (Next.js, npm run start -w apps/web)

Hetzner VPS (/opt/signal-archive, Docker Compose)
├── worker         (BullMQ consumers: deletion detection, HCS, severity scoring)
├── ingest         (node-cron daemon: browser-ingest.ts --cdp on tier schedule)
├── chrome         (Headless Chrome CDP target, SOCKS5 proxy for residential egress)
└── redis          (VPS-local Redis for BullMQ state)

External services:
├── Neon Postgres   (pooled URL for web, direct URL for worker + migrations)
├── Hedera Mainnet  (HCS topics: 0.0.10301350 / 0.0.10307943 / 0.0.10310903)
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
- SocialData API key: Railway env only *(optional — worker runs without it)*
- Database credentials: Railway env only

---

## Key Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| X bot detection | SocialData.tools API (server-to-server, no browser); browser-ingest uses real Windows Chrome via CDP with anti-detection measures |
| SocialData goes down | oEmbed deletion checker activates automatically (free fallback); browser-ingest for manual ingestion backfill |
| Hedera network issues | BullMQ retry logic; content hashes stored locally regardless |
| Legal challenges | Public interest defense; only track public statements from public figures |
| Database growth | Age-based deletion check frequency; ARCHIVE_SINCE cutoff on ingestion |
| False deletion detection | Only flag on HTTP 404; 403/5xx treated as alive |

---

## What's Not Built Yet

| Item | Priority |
|------|----------|
| Twitter/X bot auto-posting deletions | High — biggest growth lever |
| Mass deletion event detection | **IMPLEMENTED** — 5+ deletions in 1hr window, `mass_deletion_events` table |
| Research: admin scripts to add wallets + donor-only accounts (with HCS attestation to `0.0.10307943`) | High — research topic exists but nothing writes to it yet |
| Media archival to Cloudflare R2 | Medium — images die when tweets deleted |
| Phase 2: Congress bulk onboarding (~535 accounts) | Medium |
| Worker health monitoring (Better Stack) | **IMPLEMENTED** — heartbeat pings every 60s; set `HEARTBEAT_URL` in Railway worker env |
| AI severity scoring | **IMPLEMENTED** — Claude Haiku 3.5, 1-10 scale, heuristic fallback |
| Freemium / API for journalists | Phase 4 |
| HCS-13 schema registry — publish attestation schema to HCS for third-party validation | Deferred — confer with ecosystem builders before implementing |
| Add `categoryTags` to deletion HCS messages (currently DB-only) | Deferred — implications under consideration |
| HIP-1139 immutable topic — disable admin key on `0.0.10301350` | Deferred — HIP not yet live on mainnet (as of March 2026) |
