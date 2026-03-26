# Technical Debt Fixes — 17-Item Assessment Resolution

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` or `subagent-driven-development` to implement this plan.

**Goal:** Fix all 17 items from the technical assessment, covering schema integrity, worker reliability, proof correctness, and code quality.
**Architecture:** Changes span the `packages/db` schema, `packages/shared` constants/types, `apps/worker` jobs/services, and `apps/web` API routes. Schema changes require a single Drizzle migration (0006). Most code changes are independent and can execute in parallel after the schema migration lands.
**Tech Stack:** TypeScript, Drizzle ORM (Postgres), BullMQ, Hedera SDK, Next.js API routes, Zod.

---

## Phase 1 — Schema Changes (must complete before migration)

### Task 1: Fix HCS attestations — add `message_type` column + fix unique index

**Item:** #1 (deletion attestations silently dropped)

**Files:**
- Modify: `packages/db/src/schema/hcs-attestations.ts`

**Step 1: No failing test needed** — this is a schema-only change; code fix in Task 6.

**Step 2: Implement**

Replace the schema file content with:

```typescript
import {
  pgTable,
  uuid,
  text,
  bigint,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tweets } from "./tweets";

export const hcsAttestations = pgTable(
  "hcs_attestations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tweetId: uuid("tweet_id").references(() => tweets.id),
    messageType: text("message_type").notNull().default("tweet_attestation"),
    topicId: text("topic_id").notNull(),
    sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
    transactionId: text("transaction_id").notNull(),
    contentHash: text("content_hash").notNull(),
    consensusTimestamp: timestamp("consensus_timestamp", { withTimezone: true }).notNull(),
    messagePayload: jsonb("message_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_hcs_tweet_type").on(table.tweetId, table.messageType),
  ]
);
```

Key changes: added `messageType` column with default `"tweet_attestation"` (preserves existing rows); changed unique index from `(tweetId)` to `(tweetId, messageType)`.

**Step 3: Verify**
```bash
npm run typecheck
```
Expected: no errors.

---

### Task 2: Fix deletion_events — add unique constraint on tweet_id + notNull on account_id + remove dead column

**Items:** #3 (no-op onConflictDoNothing), partial #16 (dead column)

**Files:**
- Modify: `packages/db/src/schema/deletion-events.ts`

**Step 1: No failing test.**

**Step 2: Implement**

```typescript
import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tweets } from "./tweets";
import { trackedAccounts } from "./tracked-accounts";

export const deletionEvents = pgTable(
  "deletion_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tweetId: uuid("tweet_id").references(() => tweets.id).notNull(),
    accountId: uuid("account_id").references(() => trackedAccounts.id).notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
    tweetAgeHours: numeric("tweet_age_hours"),
    contentPreview: text("content_preview"),
    categoryTags: text("category_tags").array(),
    severityScore: integer("severity_score"),
    // hcsProofTxn removed — never populated; HCS record lives in hcs_attestations
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("idx_deletions_account").on(table.accountId, table.detectedAt),
    index("idx_deletions_severity").on(table.severityScore),
    uniqueIndex("idx_deletions_tweet").on(table.tweetId),
  ]
);
```

Changes: removed `hcsProofTxn`; added `.notNull()` to `tweetId` and `accountId`; added `uniqueIndex` on `tweetId`.

> ⚠️ **Migration note:** If the production DB has duplicate `tweetId` rows in `deletion_events`, `db:migrate` will fail. Run this first to check:
> ```sql
> SELECT tweet_id, COUNT(*) FROM deletion_events GROUP BY tweet_id HAVING COUNT(*) > 1;
> ```
> If duplicates exist, delete all but the first (lowest `detected_at`) before migrating.

**Step 3: Verify**
```bash
npm run typecheck
```

---

### Task 3: Fix tweets schema — add partial index + remove dead `engagement` column

**Items:** #5 (missing index on is_deleted), partial #16 (dead column)

**Files:**
- Modify: `packages/db/src/schema/tweets.ts`

**Step 2: Implement**

In `tweets.ts`, remove the `engagement` field and add a partial index. Replace the table definition:

```typescript
import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { trackedAccounts } from "./tracked-accounts";

export const tweets = pgTable(
  "tweets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tweetId: text("tweet_id").unique().notNull(),
    accountId: uuid("account_id").references(() => trackedAccounts.id),
    authorId: text("author_id").notNull(),
    content: text("content").notNull(),
    rawJson: jsonb("raw_json").notNull(),
    tweetType: text("tweet_type").default("tweet").notNull(),
    mediaUrls: text("media_urls").array(),
    // engagement column removed — was never written to
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    contentHash: text("content_hash").notNull(),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletionDetectedAt: timestamp("deletion_detected_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_tweets_account").on(table.accountId),
    index("idx_tweets_posted").on(table.postedAt),
    index("idx_tweets_content_hash").on(table.contentHash),
    index("idx_tweets_fts").using(
      "gin",
      sql`to_tsvector('english', ${table.content})`
    ),
    // Partial index — dramatically speeds up deletion check queries
    index("idx_tweets_not_deleted").on(table.postedAt).where(
      sql`${table.isDeleted} = false`
    ),
  ]
);
```

**Step 3: Verify**
```bash
npm run typecheck
```

---

### Task 4: Fix tracked_accounts — add unique constraint on username

**Item:** #6

**Files:**
- Modify: `packages/db/src/schema/tracked-accounts.ts`

**Step 2: Implement**

Add `.unique()` to the `username` field:

```typescript
username: text("username").unique().notNull(),
```

> ⚠️ **Migration note:** If duplicate usernames exist, migration will fail. Check first:
> ```sql
> SELECT username, COUNT(*) FROM tracked_accounts GROUP BY username HAVING COUNT(*) > 1;
> ```

**Step 3: Verify**
```bash
npm run typecheck
```

---

### Task 5: Remove dead tables — engagement_snapshots and tracking_requests

**Item:** #16

**Files:**
- Delete: `packages/db/src/schema/engagement-snapshots.ts`
- Delete: `packages/db/src/schema/tracking-requests.ts`
- Modify: `packages/db/src/schema/index.ts`

**Step 2: Implement**

Delete both schema files. Then in `packages/db/src/schema/index.ts`, remove these two export lines:

```typescript
export { engagementSnapshots } from "./engagement-snapshots";
export { trackingRequests } from "./tracking-requests";
```

**Step 3: Verify**
```bash
npm run typecheck
```
Expected: no errors (no code references these tables).

---

### Task 6: Generate and run migration 0006

**Step 1:** Confirm no duplicate-key issues in prod (see Task 2 and Task 4 warnings above).

**Step 2:**
```bash
npm run db:generate
```
Expected: creates `packages/db/drizzle/0006_*.sql`. Review the generated SQL to confirm:
- `ALTER TABLE hcs_attestations ADD COLUMN message_type text NOT NULL DEFAULT 'tweet_attestation'`
- `DROP INDEX idx_hcs_tweet` + `CREATE UNIQUE INDEX idx_hcs_tweet_type ON hcs_attestations(tweet_id, message_type)`
- `ALTER TABLE deletion_events DROP COLUMN hcs_proof_txn`
- `ALTER TABLE deletion_events ALTER COLUMN tweet_id SET NOT NULL` + `ALTER COLUMN account_id SET NOT NULL`
- `CREATE UNIQUE INDEX idx_deletions_tweet ON deletion_events(tweet_id)`
- `ALTER TABLE tweets DROP COLUMN engagement`
- `CREATE INDEX idx_tweets_not_deleted ON tweets(posted_at) WHERE is_deleted = false`
- `ALTER TABLE tracked_accounts ADD UNIQUE (username)`
- `DROP TABLE engagement_snapshots`
- `DROP TABLE tracking_requests`

**Step 3:**
```bash
npm run db:migrate
```
Expected: migration applies cleanly.

**Step 4: Verify**
```bash
npm run typecheck
```

---

## Phase 2 — Worker Code Fixes

### Task 7: Fix HCS idempotency guard — check (tweetId, messageType) not just tweetId

**Item:** #1 (code half)

**Files:**
- Modify: `apps/worker/src/jobs/submit-hcs.ts`

**Step 2: Implement**

In `processHcsSubmission`, update the import and idempotency guard:

1. Add `and` to the drizzle import:
```typescript
import { eq, and } from "drizzle-orm";
```

2. Replace the idempotency check (lines 53-62) with:
```typescript
// Skip if this exact message type was already attested (idempotency guard)
const existing = await db
  .select({ id: hcsAttestations.id })
  .from(hcsAttestations)
  .where(
    and(
      eq(hcsAttestations.tweetId, dbId),
      eq(hcsAttestations.messageType, type)
    )
  )
  .limit(1);

if (existing.length > 0) {
  console.log(`[submit-hcs] Already attested ${type} for tweet ${tweetId}, skipping`);
  return;
}
```

3. Update the `db.insert(hcsAttestations).values(...)` call to include `messageType`:
```typescript
await db.insert(hcsAttestations).values({
  tweetId: dbId,
  messageType: type,
  topicId,
  sequenceNumber,
  transactionId,
  contentHash,
  consensusTimestamp,
  messagePayload: payload,
});
```

**Step 3: Verify**
```bash
npm run typecheck
```

---

### Task 8: Add retry config to all four BullMQ workers

**Item:** #2

**Files:**
- Modify: `apps/worker/src/jobs/ingest.ts`
- Modify: `apps/worker/src/jobs/check-deletions.ts`
- Modify: `apps/worker/src/jobs/submit-hcs.ts`
- Modify: `apps/worker/src/jobs/archive-media.ts`

**Step 2: Implement**

In each worker factory function, add `attempts` and `backoff` to the Worker options. Use 3 attempts for all workers, exponential backoff starting at 2s. For `hcs-submit`, use 5 attempts due to higher consequence of failure.

`ingest.ts` — change `{ connection, concurrency: 5 }` to:
```typescript
{ connection, concurrency: 5, settings: { backoffStrategy: (attempt) => Math.min(1000 * 2 ** attempt, 30000) }, attempts: 3 }
```

Actually, BullMQ uses `defaultJobOptions` on the Worker for retry. The correct pattern is to set `attempts` and `backoff` in the job's default options. Since these are repeatable jobs registered on the queue, set them in the Worker's `defaultJobOptions`:

`ingest.ts`:
```typescript
return new Worker(
  QUEUE_NAMES.INGESTION,
  (job: Job<IngestJobData>) => processIngestion(job, provider),
  {
    connection,
    concurrency: 5,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    },
  }
);
```

`check-deletions.ts`:
```typescript
return new Worker(
  QUEUE_NAMES.DELETION_CHECK,
  (job: Job<CheckDeletionsJobData>) => processDeletionCheck(job, checker),
  {
    connection,
    concurrency: 1,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    },
  }
);
```

`submit-hcs.ts`:
```typescript
return new Worker(QUEUE_NAMES.HCS_SUBMIT, processHcsSubmission, {
  connection,
  concurrency: 1,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 },
  },
});
```

`archive-media.ts`:
```typescript
return new Worker(QUEUE_NAMES.MEDIA_ARCHIVE, processMediaArchive, {
  connection,
  concurrency: 3,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  },
});
```

**Step 3: Verify**
```bash
npm run typecheck -w apps/worker
```

---

### Task 9: Persist cycleCount in Redis

**Item:** #4

**Files:**
- Modify: `apps/worker/src/jobs/check-deletions.ts`

**Step 2: Implement**

Add a Redis key constant and replace `job.data.cycleCount` reads/writes with Redis GET/SET.

At the top of the file, after existing imports, add:
```typescript
const CYCLE_COUNT_KEY = "worker:deletion-cycle-count";
```

In `processDeletionCheck`, replace:
```typescript
const cycleCount = job.data.cycleCount ?? 0;
```
with:
```typescript
const cycleCountRaw = await connection.get(CYCLE_COUNT_KEY);
const cycleCount = cycleCountRaw ? parseInt(cycleCountRaw, 10) : 0;
```

Replace all `await job.updateData({ cycleCount: cycleCount + 1 });` calls (there are two — one in the early return and one at the end) with:
```typescript
await connection.set(CYCLE_COUNT_KEY, String(cycleCount + 1));
```

Import `connection` is already imported from `"../queues"`.

**Step 3: Verify**
```bash
npm run typecheck -w apps/worker
```

---

### Task 10: Increase deletion check batch size

**Item:** #8

**Files:**
- Modify: `packages/shared/src/constants.ts`

**Step 2: Implement**

Change:
```typescript
export const DELETION_CHECK_BATCH_SIZE = 25;
```
to:
```typescript
export const DELETION_CHECK_BATCH_SIZE = 100;
```

**Step 3: Verify**
```bash
npm run typecheck
```

---

### Task 11: Batch dedup queries in ingestion + handle insert conflicts

**Item:** #9

**Files:**
- Modify: `apps/worker/src/jobs/ingest.ts`

**Step 2: Implement**

Replace the per-tweet existence check loop with a single batch query. In `processIngestion`, after filtering by ARCHIVE_SINCE, replace the for-loop that does individual lookups with:

1. After collecting `scraped` tweets, batch-filter by existing tweet IDs:
```typescript
// Filter out tweets before cutoff
const eligible = scraped.filter((t) => t.postedAt >= ARCHIVE_SINCE);

// Batch dedup: fetch all known tweet IDs in one query
const scrapedIds = eligible.map((t) => t.tweetId);
const existingRows =
  scrapedIds.length > 0
    ? await db
        .select({ tweetId: tweets.tweetId })
        .from(tweets)
        .where(sql`${tweets.tweetId} = ANY(${sql.raw(`ARRAY[${scrapedIds.map(() => "?").join(",")}]`)})`)
        .execute()
    : [];
```

Actually, Drizzle doesn't have a clean `IN` array helper this way. Use `inArray`:

```typescript
import { inArray } from "drizzle-orm";

const scrapedIds = eligible.map((t) => t.tweetId);
const existingRows =
  scrapedIds.length > 0
    ? await db
        .select({ tweetId: tweets.tweetId })
        .from(tweets)
        .where(inArray(tweets.tweetId, scrapedIds))
    : [];

const existingSet = new Set(existingRows.map((r) => r.tweetId));
const toInsert = eligible.filter((t) => !existingSet.has(t.tweetId));
```

2. Then loop over `toInsert` (not `scraped`) for insert + queue operations. Wrap each insert in a try/catch to handle race-condition duplicate inserts gracefully:

```typescript
for (const tweet of toInsert) {
  const canonical: CanonicalTweet = { ... };
  const contentHash = computeContentHash(canonical);

  let inserted: { id: string } | undefined;
  try {
    const [row] = await db
      .insert(tweets)
      .values({ ... })
      .returning({ id: tweets.id });
    inserted = row;
    newCount++;
  } catch (err: unknown) {
    // Unique constraint violation — another worker inserted this tweet concurrently
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      dupeCount++;
      continue;
    }
    throw err;
  }

  // Queue HCS and media jobs only if insert succeeded
  if (inserted) {
    await hcsSubmitQueue.add(...);
    if (tweet.mediaUrls.length > 0) { await mediaArchiveQueue.add(...); }
  }
}
```

Also update `skippedCount` to count pre-cutoff tweets separately (they are no longer in `eligible`):
```typescript
const skippedCount = scraped.length - eligible.length;
```

Remove the old per-tweet `db.query.tweets.findFirst` call entirely.

**Step 3: Verify**
```bash
npm run typecheck -w apps/worker
```

---

### Task 12: Move jitter to per-execution, remove from scheduler

**Item:** #12

**Files:**
- Modify: `apps/worker/src/scheduler.ts`
- Modify: `apps/worker/src/jobs/ingest.ts`

**Step 2: Implement**

In `scheduler.ts`, replace:
```typescript
const interval = applyJitter(baseInterval);
```
with:
```typescript
const interval = baseInterval;
```

Remove the `applyJitter` import from `@taa/shared` in `scheduler.ts` (if it's the only usage).

In `ingest.ts`, at the start of `processIngestion`, add a random execution delay (0-20% of tier interval) before making any API call:

```typescript
import { TIER_INTERVALS, JITTER_FACTOR } from "@taa/shared";

async function processIngestion(job: Job<IngestJobData>, provider: TweetProvider) {
  const { accountId, username, tier } = job.data;

  // Per-execution jitter — spread API calls to avoid fingerprinting
  const baseInterval = TIER_INTERVALS[tier];
  const jitterMs = Math.floor(Math.random() * baseInterval * JITTER_FACTOR);
  if (jitterMs > 0) await new Promise((r) => setTimeout(r, jitterMs));

  console.log(`[ingest] Processing @${username} (tier: ${tier})`);
  // ... rest of function
```

**Step 3: Verify**
```bash
npm run typecheck -w apps/worker
```

---

### Task 13: Fix mock provider RNG seed

**Item:** #17

**Files:**
- Modify: `apps/worker/src/services/mock-provider.ts`

**Step 2: Implement**

In `createMockProvider`, change:
```typescript
const seed = `${username}-${now}`;
```
to:
```typescript
const seed = `${username}-mock`;
```

Also remove `const now = Date.now();` and replace its usage in tweet ID generation with `Date.now()` inline (since `now` is still needed there):

```typescript
async fetchTweets(username: string, twitterId: string) {
  const seed = `${username}-mock`;
  const rng = seededRandom(seed);
  const ts = Date.now();

  const count = 2 + Math.floor(rng() * 6);
  const authorId = twitterId || deterministicAuthorId(username);
  const tweets: ScrapedTweet[] = [];

  for (let i = 0; i < count; i++) {
    const tweetId = `mock_${ts}_${i}_${Math.floor(rng() * 100000)}`;
    // ... rest of loop uses rng() for content, age, type, media
```

**Step 3: Verify**
```bash
npm run typecheck -w apps/worker
```

---

## Phase 3 — HCS Types Alignment

### Task 14: Align HcsAttestationMessage types with actual payload

**Item:** #11

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 2: Implement**

Replace the unused `HcsAttestationMessage` and `HcsDeletionMessage` interfaces with types that match the actual payload built in `submit-hcs.ts`:

```typescript
/** On-chain HCS message payload — matches the structure submitted by submit-hcs.ts */
export interface HcsTweetAttestationPayload {
  type: "tweet_attestation";
  tweetId: string;
  authorId: string;
  username: string;
  postedAt: string; // ISO 8601
  contentHash: string;
  topicId: string;
  submittedAt: string; // ISO 8601
}

export interface HcsDeletionPayload {
  type: "deletion_detected";
  tweetId: string;
  authorId: string;
  username: string;
  postedAt: string; // ISO 8601
  contentHash: string;
  topicId: string;
  submittedAt: string; // ISO 8601
  severity?: number;
  severityModel?: string | null;
  severityConfidence?: number | null;
}

export type HcsPayload = HcsTweetAttestationPayload | HcsDeletionPayload;
```

Remove the old `HcsAttestationMessage` and `HcsDeletionMessage` types.

**Step 3: Verify**
```bash
npm run typecheck
```

---

## Phase 4 — Web/API Fixes

### Task 15: Fix health endpoint — support TLS (rediss://) Redis URLs

**Item:** #7

**Files:**
- Modify: `apps/web/app/api/health/route.ts`

**Step 2: Implement**

Replace `createConnection` (plain TCP) with conditional TLS support. Update the import at the top:

```typescript
import { createConnection } from "net";
import { connect as tlsConnect } from "tls";
```

In the `redisQuery` function, detect scheme and use the appropriate connection:

```typescript
async function redisQuery(commands: string[][]): Promise<(string | null)[]> {
  return new Promise((resolve) => {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    const isTls = url.startsWith("rediss://");
    const match = url.match(/rediss?:\/\/(?:[^@]+@)?([^:]+):(\d+)/);
    const host = match?.[1] ?? "localhost";
    const port = parseInt(match?.[2] ?? "6379", 10);

    const socket = isTls
      ? tlsConnect({ host, port, rejectUnauthorized: false })
      : createConnection({ host, port });

    let buffer = "";

    const timer = setTimeout(() => {
      socket.destroy();
      resolve(commands.map(() => null));
    }, 2000);

    socket.on("connect", () => {
      const pipeline = commands.map(buildRespCommand).join("");
      socket.write(pipeline);
    });

    // For TLS, "secureConnect" fires instead of "connect"
    socket.on("secureConnect", () => {
      const pipeline = commands.map(buildRespCommand).join("");
      socket.write(pipeline);
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      const results = parseRespResponses(buffer);
      if (results.length >= commands.length) {
        clearTimeout(timer);
        socket.destroy();
        resolve(results.slice(0, commands.length));
      }
    });

    socket.on("error", () => {
      clearTimeout(timer);
      resolve(commands.map(() => null));
    });
  });
}
```

> Note: `rejectUnauthorized: false` is acceptable here because this is an internal health check connecting to a private Redis instance, not validating a public certificate.

**Step 3: Verify**
```bash
npm run typecheck -w apps/web
```

---

### Task 16: Remove `predictedSerial` wasted mirror node call

**Item:** #13

**Files:**
- Modify: `apps/web/app/api/donations/execute/route.ts`

**Step 2: Implement**

In `execute/route.ts`, remove:
1. The `predictedSerial` variable declaration (line ~168): `let predictedSerial: number | null = null;`
2. The call `predictedSerial = (await getBadgeTokenSupply()) + 1;` (line ~171)
3. Since `getBadgeTokenSupply()` is now unused, delete the entire function (lines ~80-87).

**Step 3: Verify**
```bash
npm run typecheck -w apps/web
```

---

### Task 17: Add Zod validation to donation routes

**Item:** #15

**Files:**
- Modify: `apps/web/app/api/donations/prepare/route.ts`
- Modify: `apps/web/app/api/donations/execute/route.ts`
- Modify: `apps/web/app/api/donations/verify/route.ts`

**Step 2: Implement**

Add Zod schemas at the top of each route file (Zod is already a dependency via `@taa/shared`).

**prepare/route.ts** — add after imports:
```typescript
import { z } from "zod";

const prepareSchema = z.object({
  walletAddress: z.string().min(1),
  asset: z.enum(["hbar", "usdc"]),
  amount: z.number().positive(),
});
```

In the `POST` handler, replace the manual field checks with:
```typescript
const parsed = prepareSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json(
    { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
    { status: 400 }
  );
}
const { walletAddress, asset, amount } = parsed.data;
```

**execute/route.ts** — add schema:
```typescript
const executeSchema = z.object({
  batchId: z.string().min(1),
  transferTransactionId: z.string().min(1),
});
```

Replace manual checks with `executeSchema.safeParse(body)`.

**verify/route.ts** — add schema:
```typescript
const verifySchema = z.object({
  transactionId: z.string().min(1),
  walletAddress: z.string().min(1),
  asset: z.enum(["hbar", "usdc"]),
});
```

Replace manual checks with `verifySchema.safeParse(body)`.

**Step 3: Verify**
```bash
npm run typecheck -w apps/web
```

---

## Phase 5 — Documentation

### Task 18: Update ARCHITECTURE.md — fix stale feature status

**Item:** #10

**Files:**
- Modify: `docs/ARCHITECTURE.md`

**Step 2: Implement**

1. Find and update references that say "Mass deletion event detection" and "AI severity scoring" are not yet built — change to reflect they are implemented.
2. Find the `engagement JSONB` column documentation and remove it (column has been dropped in migration).
3. Find the `hcs_proof_txn` column documentation and remove it (column dropped in migration).
4. Update the "engagement_snapshots" and "tracking_requests" table documentation — note they were removed as unused stubs.
5. Add a note that the `hcs_attestations` table now has a `message_type` column to distinguish tweet attestations from deletion attestations.

**Step 3: Verify** — visual review only, no command needed.

---

## Final Verification

After all tasks complete:

```bash
npm run typecheck   # must pass with zero errors
npm run test        # must pass
npm run build       # must succeed for both apps
```

Confirm the migration ran:
```bash
npm run db:migrate
```

Check that deletion attestations are now distinct from tweet attestations by verifying the schema:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'hcs_attestations' AND column_name = 'message_type';
-- should return 1 row

SELECT indexname FROM pg_indexes
WHERE tablename = 'hcs_attestations' AND indexname = 'idx_hcs_tweet_type';
-- should return 1 row
```

---

## Execution Order Summary

Tasks can be parallelized within each phase but phases must run in order:

```
Phase 1 (Schema TS): Tasks 1-5 in parallel
    ↓
Phase 1 (Migration): Task 6 — generate + migrate
    ↓
Phase 2 (Worker): Tasks 7-13 in parallel
Phase 3 (Types):   Task 14 in parallel with Phase 2
Phase 4 (Web):     Tasks 15-17 in parallel with Phase 2
Phase 5 (Docs):    Task 18 anytime
```
