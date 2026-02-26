# Tweet Accountability Archive (TAA)

## Project Overview

A public accountability platform that monitors, records, and cryptographically attests tweets from public figures — particularly those with legal obligations to preserve public statements or patterns of deleting incriminating content. Proof of tweet existence is anchored to the Hedera Consensus Service (HCS), creating an immutable, independently verifiable record.

---

## MVP Scope & Priorities

### Phase 1: Trump Family & Political Crypto Deletion Tracking
- Track Trump family accounts, affiliated crypto project accounts (World Liberty Financial, $TRUMP, $MELANIA related accounts)
- Track key political appointees known for deletion patterns (e.g., Kash Patel)
- Focus on crypto-related tweet deletions as the headline feature
- **Target: ~50-100 accounts**

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
│                        TWEET ACCOUNTABILITY ARCHIVE                  │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────────┐     │
│  │   Ingestion   │───▶│  PostgreSQL   │───▶│  HCS Attestation   │     │
│  │    Agent      │    │   Database    │    │     Service         │     │
│  └──────────────┘    └──────┬───────┘    └────────────────────┘     │
│                             │                                        │
│  ┌──────────────┐           │            ┌────────────────────┐     │
│  │   Deletion    │───────▶──┤            │   Hedera Consensus  │     │
│  │   Detection   │          │            │      Service         │     │
│  │    Agent      │          │            └────────────────────┘     │
│  └──────────────┘           │                                        │
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
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Runtime | **Node.js (TypeScript)** | Hedera SDK is JS-native, good async I/O for polling |
| Database | **PostgreSQL** | Full-text search, JSONB for tweet metadata, proven at scale |
| ORM | **Drizzle ORM** | Type-safe, lightweight, great migration support |
| Job Scheduling | **BullMQ + Redis** | Reliable job queues for ingestion, deletion checks, HCS submissions |
| API Layer | **Next.js API Routes** or **Fastify** | Depends on whether we co-locate with frontend |

### Frontend
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | **Next.js 14+ (App Router)** | SSR for SEO (public accountability tool needs discoverability), API routes |
| Styling | **Tailwind CSS** | Rapid UI development |
| Search | **PostgreSQL full-text search** (MVP) → **Meilisearch** (scale) | Postgres FTS is surprisingly good; upgrade path clear |

### Blockchain / Attestation
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Consensus Layer | **Hedera Consensus Service (HCS)** | Immutable timestamped proof, low cost (~$0.0008/msg as of Jan 2026) |
| Hedera SDK | **@hashgraph/sdk** | Official JS SDK |
| Hash Algorithm | **SHA-256** | Industry standard, deterministic |

### Infrastructure
| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Hosting | **VPS (Hetzner or Railway)** | Cost-effective for MVP, easy to scale |
| Database Hosting | **Managed Postgres (Neon or Supabase)** | Free tier to start, auto-scaling |
| Redis | **Upstash Redis** | Serverless, free tier available |
| Monitoring | **Better Stack or Grafana Cloud** | Log aggregation, uptime monitoring |
| CI/CD | **GitHub Actions** | Standard, free for public repos |

---

## Database Schema (PostgreSQL)

### Core Tables

```sql
-- Tracked accounts
CREATE TABLE tracked_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twitter_id      TEXT UNIQUE NOT NULL,          -- X/Twitter numeric ID (stable)
    username        TEXT NOT NULL,                  -- Current handle (can change)
    display_name    TEXT,
    category        TEXT NOT NULL,                  -- 'trump_family', 'congress', 'agency', 'crypto_caller', etc.
    subcategory     TEXT,                           -- 'senate', 'house', 'white_house', etc.
    tracking_tier   TEXT DEFAULT 'standard',        -- 'priority' (5min), 'standard' (15min), 'low' (60min)
    is_active       BOOLEAN DEFAULT true,
    metadata        JSONB,                          -- Party, state, role, affiliated projects, etc.
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Archived tweets
CREATE TABLE tweets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id        TEXT UNIQUE NOT NULL,           -- X/Twitter tweet ID
    account_id      UUID REFERENCES tracked_accounts(id),
    author_id       TEXT NOT NULL,                  -- Twitter user ID (for RTs, quotes)
    content         TEXT NOT NULL,                  -- Full tweet text
    raw_json        JSONB NOT NULL,                 -- Complete API response / scraped data
    tweet_type      TEXT DEFAULT 'tweet',           -- 'tweet', 'reply', 'retweet', 'quote'
    media_urls      TEXT[],                         -- Archived media references
    engagement      JSONB,                          -- {likes, retweets, replies, views} at capture time
    posted_at       TIMESTAMPTZ NOT NULL,           -- When the tweet was originally posted
    captured_at     TIMESTAMPTZ DEFAULT now(),      -- When we first recorded it
    content_hash    TEXT NOT NULL,                  -- SHA-256 of canonical JSON
    is_deleted      BOOLEAN DEFAULT false,
    deleted_at      TIMESTAMPTZ,                    -- When we detected deletion
    deletion_detected_at TIMESTAMPTZ,               -- When our system flagged it
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Full-text search index
CREATE INDEX idx_tweets_fts ON tweets USING GIN (to_tsvector('english', content));
CREATE INDEX idx_tweets_account ON tweets (account_id);
CREATE INDEX idx_tweets_posted ON tweets (posted_at DESC);
CREATE INDEX idx_tweets_deleted ON tweets (is_deleted, deleted_at DESC) WHERE is_deleted = true;
CREATE INDEX idx_tweets_tweet_id ON tweets (tweet_id);
CREATE INDEX idx_tweets_content_hash ON tweets (content_hash);

-- HCS attestation records
CREATE TABLE hcs_attestations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id        UUID REFERENCES tweets(id),
    topic_id        TEXT NOT NULL,                  -- HCS Topic ID
    sequence_number BIGINT NOT NULL,               -- HCS message sequence number
    transaction_id  TEXT NOT NULL,                  -- Hedera transaction ID
    content_hash    TEXT NOT NULL,                  -- SHA-256 hash that was submitted
    consensus_timestamp TIMESTAMPTZ NOT NULL,      -- Hedera consensus timestamp
    message_payload JSONB,                          -- What was sent to HCS
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_hcs_tweet ON hcs_attestations (tweet_id);

-- Deletion events (rich deletion tracking)
CREATE TABLE deletion_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id        UUID REFERENCES tweets(id),
    account_id      UUID REFERENCES tracked_accounts(id),
    detected_at     TIMESTAMPTZ DEFAULT now(),
    tweet_age_hours NUMERIC,                       -- How old the tweet was when deleted
    content_preview TEXT,                           -- First 280 chars for quick display
    category_tags   TEXT[],                         -- 'crypto', 'policy', 'legal', 'controversy'
    severity_score  INTEGER,                        -- 1-10 computed importance (future: AI-assessed)
    hcs_proof_txn   TEXT,                           -- Reference to HCS attestation transaction
    metadata        JSONB                           -- Additional context
);

CREATE INDEX idx_deletions_account ON deletion_events (account_id, detected_at DESC);
CREATE INDEX idx_deletions_severity ON deletion_events (severity_score DESC);

-- Engagement snapshots (track engagement over time for deleted tweets)
CREATE TABLE engagement_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id        UUID REFERENCES tweets(id),
    likes           INTEGER,
    retweets        INTEGER,
    replies         INTEGER,
    views           BIGINT,
    captured_at     TIMESTAMPTZ DEFAULT now()
);

-- Account tracking requests (freemium feature, Phase 4)
CREATE TABLE tracking_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_username TEXT NOT NULL,
    requested_by    TEXT,                           -- Email or user ID
    reason          TEXT,
    status          TEXT DEFAULT 'pending',         -- 'pending', 'approved', 'rejected', 'active'
    is_paid         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## Service Architecture Details

### 1. Tweet Ingestion Agent

**Primary data source: [SocialData.tools](https://api.socialdata.tools) REST API**
- `GET /twitter/user/{user_id}/tweets-and-replies` — fetches ~20 tweets per page
- Response format mirrors Twitter v1.1 (`id_str`, `full_text`, `tweet_created_at`, engagement counts)
- Cost: ~$0.0002/request, shared 120 req/min rate limit
- Retweets are skipped (other people's content, not the account's own statements)
- Legacy fallback: Stagehand browser automation (requires `ANTHROPIC_API_KEY`)

**Responsibilities:**
- Poll tracked accounts for new tweets on a configurable schedule
- Capture full tweet data including text, media, metadata
- Compute SHA-256 hash of canonical JSON representation
- Store in PostgreSQL
- Queue HCS attestation job

**Scheduling Tiers:**
| Tier | Interval | Use Case |
|------|----------|----------|
| Priority | Every 30 minutes | Trump family, active controversy accounts |
| Standard | Every 2 hours | Congress, agency accounts |
| Low | Every 6 hours | Lower-priority tracked accounts |

**Canonical JSON for Hashing:**
```typescript
interface CanonicalTweet {
  tweet_id: string;
  author_id: string;
  content: string;
  posted_at: string;        // ISO 8601
  media_urls: string[];     // Sorted
  tweet_type: string;
}

function computeHash(tweet: CanonicalTweet): string {
  // Sort keys deterministically, then SHA-256
  const canonical = JSON.stringify(tweet, Object.keys(tweet).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}
```

**Key Design Decisions:**
- Use Twitter numeric user IDs (not handles) as the stable identifier — handles change
- Store raw API/scrape response in `raw_json` for future-proofing
- Compute hash from a canonical subset (not raw JSON) so the hash is reproducible

### 2. HCS Attestation Service

**Topic Structure:**
- One HCS Topic per logical group (e.g., `trump-family`, `congress-senate`, `congress-house`, `agencies`)
- Topic IDs stored in config, referenced in attestation records

**Message Format (submitted to HCS):**
```json
{
  "version": "1.0",
  "type": "tweet_attestation",
  "tweet_id": "1893456789012345678",
  "author_id": "123456789",
  "content_hash": "a1b2c3d4e5f6...",
  "captured_at": "2026-02-24T15:30:00Z",
  "posted_at": "2026-02-24T14:00:00Z"
}
```

**Verification Flow (for any third party):**
1. Get tweet JSON from TAA database (or API)
2. Compute `SHA-256(canonical_json(tweet))`
3. Look up HCS message by topic + sequence number
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
- Sequential per-tweet checks with shared rate limiter (120 req/min)
- Conservative: HTTP 403 (private) / 5xx → assume tweet exists; only 404 → mark deleted
- Legacy fallback: Stagehand browser automation

**Approach:**
- BullMQ scheduled job runs per-tier
- For each tracked account, check all non-deleted tweet IDs from the last N days
- Sequential check via SocialData API (individual GET per tweet)
- On 404/not-found: mark as deleted, create deletion_event, queue HCS deletion attestation

**Batch Strategy:**
- Check most recent tweets first (most likely to be deleted)
- Exponential backoff on check frequency for older tweets
  - < 7 days old: check every cycle
  - 7-30 days: check every 4 cycles
  - 30-90 days: check daily
  - > 90 days: check weekly

**Smart Detection (Future Enhancement):**
- If multiple tweets from same account deleted in short window → flag as "mass deletion event"
- If tweet contains specific keywords (crypto tickers, company names, legal terms) → higher severity
- Track deletion patterns per account (e.g., "deletes 80% of crypto tweets within 48 hours")

### 4. Web Portal (Next.js)

**Core Pages:**

| Route | Description |
|-------|-------------|
| `/` | Landing page — recent notable deletions, stats, mission statement |
| `/accounts` | Browse tracked accounts by category, search |
| `/accounts/[username]` | Account profile — all tweets, deletion rate, timeline |
| `/deletions` | Deletion feed — filterable by category, severity, recency |
| `/tweet/[id]` | Individual tweet detail — content, HCS proof, verification link |
| `/verify/[hash]` | Public verification page — check any hash against HCS |
| `/search` | Full-text search across all archived tweets |
| `/about` | Mission, methodology, how verification works |
| `/request` | Request an account to be tracked (Phase 4) |

**Key Frontend Features:**
- Real-time deletion feed (WebSocket or polling)
- Account "deletion score" — visual indicator of how frequently an account deletes
- Side-by-side comparison: what was posted vs. that it was deleted
- Shareable verification links (for journalists, researchers)
- Export functionality (CSV, JSON) for researchers
- Mobile-responsive (many people will share these on social media)

**SEO / Discoverability:**
- Server-rendered pages for each deleted tweet (Google-indexable)
- Open Graph meta tags for social sharing ("@realDonaldTrump deleted a tweet about $TRUMP token")
- RSS feed for deletions

---

## Twitter/X Data Access Strategy

### Current X API Landscape (as of Feb 2026)

The X API has been completely overhauled since the Musk acquisition:
- **Free tier**: Write-only, ~500 posts/month, almost no read access
- **Basic tier ($100-200/mo)**: ~10K-15K tweets/month read, 7-day search window only
- **Pro tier ($5,000/mo)**: ~1M tweets/month read, full archive search
- **Enterprise ($42,000+/mo)**: Custom limits, streaming
- **New pay-per-use model**: In closed beta as of Dec 2025, not widely available yet

**Critical context — Nikita Bier (X Head of Product) bot crackdown:**
- X purged 1.7M bot accounts (Oct 2025)
- Revoked API access from "infofi" apps rewarding users for posting (Jan 15, 2026)
- X search is being fully rewritten due to AI agent overload (Feb 2026)
- Bier's stated policy: "If a human is not tapping on the screen, the account and all associated accounts will likely be suspended"
- However: "While we aim to support legitimate use-cases of agents, this will take some time to do properly. For now, we recommend holding off on plugging in your bots. If it's critical, you can use the official API."
- Bot detection is being rebuilt from scratch as part of the search rewrite

**This means**: Browser-based scraping that mimics human behavior is the viable path for ingestion. Pure API bots will get caught. Raw scraping behind auth is risky. Browser automation that behaves like a human user is the sweet spot.

### Recommended Approach: Browser Automation for Ingestion

**Primary: Stagehand (by Browserbase) + headless Chrome**
- AI-native browser automation framework, now at v3
- Works with Puppeteer and CDP directly (no longer Playwright-dependent)
- Self-healing: adapts when X changes UI layout
- Key primitives: `act()`, `extract()`, `observe()` — perfect for "navigate to profile, extract tweets"
- Can run locally (free) or on Browserbase cloud (paid, with stealth/proxy features)
- Multi-language support (TS, Python, Go, Ruby, etc.)
- Production-grade: 500K+ weekly downloads, actively maintained

**Why Stagehand over raw Puppeteer:**
- X actively detects headless browsers and bot patterns
- Stagehand's self-healing means we don't break when X changes their DOM
- AI-driven extraction is more resilient than CSS selector-based scraping
- Browserbase cloud option provides stealth mode, proxy rotation, CAPTCHA solving if needed

**Alternative/Backup: Browser Use (Python)**
- 50K+ GitHub stars, open source, self-hostable
- Full autonomous agent approach — LLM decides how to navigate
- Good fallback if Stagehand has issues with X specifically
- Heavier on LLM costs (sends screenshots to vision models)

**For deletion checks: Third-party API services**
- TwitterAPI.io, SociaVault, or similar (~$0.10-0.50 per 1K tweets)
- These provide simple tweet-by-ID lookup without full browser overhead
- Much faster for batch checking hundreds of tweet IDs
- If they go down, fall back to browser-based checks

### Anti-Detection Strategy

Since X is actively rebuilding bot detection:
1. **Human-like behavior patterns**: Randomized scroll speeds, variable delays, mouse movements
2. **Session management**: Rotate authenticated sessions across multiple accounts
3. **Rate discipline**: Never exceed what a human could reasonably browse
4. **Jitter on all intervals**: ±30% randomization on poll timing
5. **Fingerprint randomization**: Browserbase provides this; for self-hosted, use stealth plugins
6. **Fallback chain**: Stagehand → Browser Use → third-party API → official API (Basic tier)

### Cost Comparison

| Approach | Monthly Cost | Tweets/Month | Reliability |
|----------|-------------|--------------|-------------|
| X Official Basic | $100-200 | 10K-15K | High (but limited) |
| X Official Pro | $5,000 | 1M | High |
| Stagehand (self-hosted) | $0 (compute only) | Unlimited* | Medium-High |
| Stagehand + Browserbase | $50-200 | Unlimited* | High |
| Third-party API (deletion checks) | $20-50 | 50K-100K lookups | Medium |
| **Recommended combo** | **$70-250** | **Phase 1 volume** | **High** |

*Rate limited by anti-detection discipline, not cost

---

## Twitter/X Data Access: Detailed Technical Approach

### Browser Automation Layer (Ingestion via Stagehand)

```typescript
// Pseudocode for Stagehand-based tweet ingestion
import { Stagehand } from '@browserbasehq/stagehand';

async function ingestAccountTweets(account: TrackedAccount) {
  const stagehand = new Stagehand({
    env: 'LOCAL', // or 'BROWSERBASE' for cloud with stealth
    modelName: 'claude-sonnet-4-5-20250929',
    enableCaching: true, // Cache selectors for repeat runs
  });

  await stagehand.init();

  // Navigate to user's profile
  await stagehand.page.goto(`https://x.com/${account.username}`);
  await stagehand.page.waitForTimeout(randomDelay(2000, 4000));

  // Use AI-driven extraction — resilient to DOM changes
  const tweets = await stagehand.extract({
    instruction: "Extract all visible tweets from this profile page. For each tweet, get: the tweet text content, the tweet ID from the URL or data attributes, the timestamp, any media URLs, and engagement counts (likes, retweets, replies, views).",
    schema: z.object({
      tweets: z.array(z.object({
        text: z.string(),
        tweetId: z.string(),
        timestamp: z.string(),
        mediaUrls: z.array(z.string()).optional(),
        likes: z.number().optional(),
        retweets: z.number().optional(),
        replies: z.number().optional(),
        views: z.number().optional(),
      }))
    })
  });

  // Scroll and extract more if needed
  for (let i = 0; i < 3; i++) {
    await stagehand.act({ action: "scroll down to load more tweets" });
    await stagehand.page.waitForTimeout(randomDelay(1500, 3000));
    // Extract newly loaded tweets...
  }

  // Process and store
  for (const tweet of tweets.tweets) {
    if (await isNewTweet(tweet.tweetId)) {
      const canonical = buildCanonicalTweet(tweet, account);
      const hash = computeHash(canonical);
      await storeTweet(tweet, account, hash);
      await hcsQueue.add('attest', { tweetId: tweet.tweetId, hash });
    }
  }

  await stagehand.close();
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```

### Stagehand Session Management

```typescript
// Session pool for anti-detection
class SessionPool {
  private sessions: AuthSession[] = [];
  private currentIndex = 0;

  async getSession(): Promise<AuthSession> {
    // Round-robin through authenticated sessions
    const session = this.sessions[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.sessions.length;

    // Check if session is still valid
    if (session.lastUsed && Date.now() - session.lastUsed < 60000) {
      // Too recent — skip to next to avoid rapid-fire from same session
      return this.getSession();
    }

    session.lastUsed = Date.now();
    return session;
  }
}
```

### Deletion Check Layer (Third-party API + Browser Fallback)

```typescript
// Primary: Use third-party API for fast batch checks
async function checkDeletionsBatch(tweetIds: string[]) {
  try {
    // Third-party API (TwitterAPI.io, SociaVault, etc.)
    const response = await thirdPartyClient.tweets.lookup(tweetIds);
    const foundIds = new Set(response.map(t => t.id));
    return tweetIds.filter(id => !foundIds.has(id));
  } catch (error) {
    // Fallback: browser-based check
    return checkDeletionsBrowser(tweetIds);
  }
}

// Fallback: Browser-based deletion check
async function checkDeletionsBrowser(tweetIds: string[]) {
  const stagehand = new Stagehand({ env: 'LOCAL' });
  await stagehand.init();
  const deleted: string[] = [];

  for (const tweetId of tweetIds) {
    await stagehand.page.goto(`https://x.com/i/status/${tweetId}`);
    await stagehand.page.waitForTimeout(randomDelay(1000, 2000));

    const pageState = await stagehand.extract({
      instruction: "Is this tweet available or has it been deleted/removed? Look for error messages like 'This post is unavailable' or 'Something went wrong'.",
      schema: z.object({
        isAvailable: z.boolean(),
        errorMessage: z.string().optional(),
      })
    });

    if (!pageState.isAvailable) {
      deleted.push(tweetId);
    }
  }

  await stagehand.close();
  return deleted;
}
```

---

## Hedera Integration Details

### Setup
```typescript
import { Client, TopicCreateTransaction, TopicMessageSubmitTransaction } from '@hashgraph/sdk';

// One-time: Create topics
const topicTx = await new TopicCreateTransaction()
  .setTopicMemo("TAA: Trump Family Tweet Attestations")
  .setAdminKey(operatorKey)      // Allows topic management
  .setSubmitKey(operatorKey)     // Restricts who can submit messages
  .execute(client);

const topicId = (await topicTx.getReceipt(client)).topicId;
```

### Submit Attestation
```typescript
async function submitAttestation(tweet: Tweet, topicId: string) {
  const message = JSON.stringify({
    version: "1.0",
    type: "tweet_attestation",
    tweet_id: tweet.tweet_id,
    author_id: tweet.author_id,
    content_hash: tweet.content_hash,
    captured_at: tweet.captured_at.toISOString(),
    posted_at: tweet.posted_at.toISOString(),
  });

  const tx = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(message)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const record = await tx.getRecord(client);

  await db.hcsAttestations.insert({
    tweet_id: tweet.id,
    topic_id: topicId,
    sequence_number: receipt.topicSequenceNumber.toNumber(),
    transaction_id: tx.transactionId.toString(),
    content_hash: tweet.content_hash,
    consensus_timestamp: record.consensusTimestamp.toDate(),
    message_payload: JSON.parse(message),
  });
}
```

### Cost Estimate
Note: HCS fee increased to $0.0008/msg as of January 2026 (8× prior rate).

| Volume | Monthly HCS Cost |
|--------|-----------------|
| 10,000 tweets/mo | ~$8.00 |
| 100,000 tweets/mo | ~$80.00 |
| 1,000,000 tweets/mo | ~$800.00 |

Extremely affordable — this is one of Hedera's strengths.

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
| `media-archive` | Download and store tweet media | 3 workers |

### Scheduling
```typescript
// Repeatable jobs
await ingestionQueue.add('poll-priority', {}, {
  repeat: { every: 30 * 60 * 1000 },  // 30 minutes
});

await deletionQueue.add('check-batch', {}, {
  repeat: { every: 15 * 60 * 1000 }, // 15 minutes
});
```

---

## Media Archival Strategy

Tweets often contain images, videos, and links that are also deleted. For MVP:

1. **Store media URLs** in the tweet record immediately
2. **Background job** downloads media to object storage (S3-compatible: Cloudflare R2 is cheapest)
3. **Screenshot capture** (optional, high value): Use Puppeteer to capture a visual screenshot of the tweet as rendered — this is powerful for public-facing proof

### Screenshot Approach (Phase 2)
```typescript
async function captureTweetScreenshot(tweetUrl: string) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(tweetUrl, { waitUntil: 'networkidle2' });
  const screenshot = await page.screenshot({ type: 'png' });
  // Store to R2/S3, link to tweet record
}
```

---

## Security Considerations

### Data Integrity
- Content hashes computed at ingestion time, immutable after HCS attestation
- Database audit logging on all mutations to `tweets` and `deletion_events` tables
- Regular integrity checks: re-hash stored tweets and verify against HCS records

### Rate Limiting & Anti-Detection (for scraping)
- Rotate session credentials
- Randomize polling intervals (±20% jitter)
- Respect rate limits aggressively — losing access is worse than missing a few tweets
- Multiple fallback scraping methods

### Access Control
- Admin dashboard for managing tracked accounts (authenticated)
- Public portal is read-only, no user accounts needed for basic access
- API rate limiting for public endpoints

---

## Deployment Architecture (MVP)

```
┌──────────────────────────────────────────────────┐
│                   Railway / Hetzner               │
│                                                   │
│  ┌─────────────┐  ┌─────────────┐               │
│  │  Next.js     │  │  Worker      │               │
│  │  (Web +API)  │  │  (BullMQ     │               │
│  │              │  │   consumers) │               │
│  └──────┬──────┘  └──────┬──────┘               │
│         │                │                        │
│         └───────┬────────┘                        │
│                 │                                  │
│         ┌──────┴──────┐                           │
│         │  Redis       │                           │
│         │  (Upstash)   │                           │
│         └─────────────┘                           │
└──────────────────────────────────────────────────┘
           │
    ┌──────┴──────┐     ┌──────────────┐
    │  PostgreSQL  │     │  Cloudflare   │
    │  (Neon)      │     │  R2 (media)   │
    └─────────────┘     └──────────────┘
           │
    ┌──────┴──────┐
    │  Hedera      │
    │  Mainnet     │
    └─────────────┘
```

### Cost Estimate (MVP)
| Service | Monthly Cost |
|---------|-------------|
| Neon Postgres (free tier → $19) | $0-19 |
| Upstash Redis (free tier) | $0 |
| Railway (web + worker) | $5-20 |
| Hedera HCS | $1-10 |
| Cloudflare R2 (10GB) | $0-2 |
| X API Basic (deletion checks) | $100 |
| Domain + DNS | $1-2 |
| **Total** | **~$110-155/mo** |

---

## Development Phases & Timeline

### Phase 1: Core MVP (Weeks 1-3)
- [ ] Project scaffolding (Next.js + TypeScript monorepo)
- [ ] PostgreSQL schema + Drizzle ORM setup
- [ ] Tweet ingestion agent (scraping approach)
- [ ] HCS attestation service
- [ ] Deletion detection agent
- [ ] Basic web portal (search, account pages, deletion feed)
- [ ] Deploy to production
- [ ] Seed with Trump family + key political crypto accounts (~50 accounts)

### Phase 2: Polish & Expand (Weeks 4-6)
- [ ] Enhanced frontend (deletion timeline visualization, account stats)
- [ ] Media archival pipeline
- [ ] Tweet screenshot capture
- [ ] Congress account bulk onboarding
- [ ] RSS feeds for deletions
- [ ] Open Graph social sharing cards
- [ ] Public verification page

### Phase 3: Intelligence Layer (Weeks 7-9)
- [ ] AI-powered deletion severity scoring
- [ ] Mass deletion event detection and alerting
- [ ] Keyword/topic clustering for deleted tweets
- [ ] Account deletion pattern analysis
- [ ] Email/webhook alerts for high-severity deletions

### Phase 4: Platform Features (Weeks 10-12)
- [ ] Account tracking request system
- [ ] User accounts for saved searches/alerts
- [ ] API for journalists and researchers
- [ ] Freemium payment integration
- [ ] Crypto alpha caller tracking module

---

## Monorepo Structure

```
tweet-accountability-archive/
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
│       ├── services/
│       │   ├── scraper.ts
│       │   ├── twitter-api.ts
│       │   ├── hedera.ts
│       │   └── hasher.ts
│       └── index.ts
├── packages/
│   ├── db/                     # Drizzle schema + migrations
│   │   ├── schema.ts
│   │   ├── migrations/
│   │   └── index.ts
│   ├── shared/                 # Shared types, utils
│   │   ├── types.ts
│   │   ├── canonical-hash.ts
│   │   └── constants.ts
│   └── config/                 # Environment config
├── scripts/
│   ├── seed-accounts.ts        # Bulk load tracked accounts
│   └── verify-integrity.ts     # Audit tool: re-verify hashes against HCS
├── docker-compose.yml          # Local dev environment
├── turbo.json
└── package.json
```

---

## Open Questions / Decisions Needed

1. **Project name / domain**: "Tweet Accountability Archive" is working title. Shorter domain for sharing? (e.g., tweetproof.org, deletewatch.io, xarchive.org)

2. **Legal review**: Should we consult with a media/tech lawyer re: scraping X data for public accountability purposes? Strong First Amendment / public interest arguments, but worth confirming.

3. **Initial account list**: Need to compile the specific Trump family, crypto project, and political appointee accounts for Phase 1 seeding.

4. **Notification system**: Should we build Twitter/X bot that auto-posts when notable deletions are detected? (e.g., @DeleteWatchBot: "🚨 @realDonaldTrump deleted a tweet about World Liberty Financial posted 3 hours ago. Archived & verified on Hedera. [link]")

5. **IPFS/Arweave redundancy**: Defer to Phase 2, or include from day one?

6. **Screenshot approach**: Worth the complexity for MVP, or defer?

---

## Key Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| X bot detection (Bier crackdown) | Stagehand's human-like behavior + session rotation + jitter; fallback chain through multiple methods |
| X changes DOM/UI | Stagehand self-healing + AI-driven extraction (not selector-dependent) |
| X API pricing changes | Architecture decouples data source from storage/attestation; can swap ingestion method without schema changes |
| Third-party API services shut down | Multiple fallback providers + browser-based deletion check as last resort |
| Hedera network issues | Queue with retry logic, local hash storage as fallback |
| Legal challenges from tracked individuals | Public interest defense, consult media lawyer, only track public statements from public figures; strong First Amendment and Presidential Records Act arguments |
| Database growth | Partitioning by date, archival strategy for old engagement snapshots |
| False deletion detection | Double-check: re-verify after 5 min delay before flagging; never flag on single failed check |
| Session/account bans on X | Pool of sessions with rotation; Browserbase cloud provides proxy diversity |
| Stagehand/Browserbase goes down | Browser Use (Python) as hot backup; raw Puppeteer as cold backup |

---

## Success Metrics

- **Coverage**: % of tracked accounts' tweets successfully captured within 15 min of posting
- **Detection speed**: Average time between tweet deletion and our detection
- **Proof integrity**: 100% hash verification pass rate (regular audits)
- **Public engagement**: Page views, shares of deletion alerts, journalist citations
- **Revenue** (Phase 4): Tracking request subscriptions, API access fees
