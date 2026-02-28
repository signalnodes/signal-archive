# Assessment: Account Page Refactor Spec

## Context

The `REFACTOR_SPEC.md` proposes refactoring `/accounts/[username]` into a tier-aware page with a Receipt Card, 5-tab SegmentedControl (Activity | Statements | Deletions | Identity | Attestations), and two tracking modes (`FULL_ARCHIVE` vs `IDENTITY_ONLY`). This assessment maps every spec placeholder to the existing codebase and flags gaps, risks, and recommendations.

---

## Placeholder-by-Placeholder Mapping

### 1. Stable Account Identifier (`stableUserId`)

**Verdict: Exists. Use `tracked_accounts.twitter_id`.**

- `tracked_accounts.twitter_id` (TEXT, UNIQUE, NOT NULL) is the stable numeric Twitter/X user ID.
- Already used as the canonical stable key internally; handles are mutable.
- The spec's route `/account/:stableUserId` would shift from the current `/accounts/[username]` route (which uses `username`).

**Risk:** Changing the route from `[username]` to `[stableUserId]` breaks existing URLs and is less human-readable.

**Recommendation:** Keep the URL as `/accounts/[username]` for SEO/readability but use `twitter_id` as the internal stable identifier. Display `twitter_id` in the Receipt Card as the copyable "Stable User ID". The adapter maps `twitter_id` -> `stableUserId` directly.

---

### 2. Tracking Mode (`trackingMode: "IDENTITY_ONLY" | "FULL_ARCHIVE"`)

**Verdict: No explicit field exists. Must be derived.**

The current schema has:
- `tracking_tier`: `"priority" | "standard" | "low"` — controls polling frequency, not tracking scope.
- `is_active`: boolean — controls whether tracking is on/off.
- No `tracking_mode` or equivalent column.

Currently **all accounts are FULL_ARCHIVE** — every tracked account gets tweets ingested, deletions checked, and attestations created. There are no identity-only accounts in the system today.

**Options:**
1. **Derive from a flag in `metadata` JSONB** — e.g., `metadata.trackingMode = "IDENTITY_ONLY"`. No schema migration needed; JSONB is already extensible.
2. **Add a `tracking_mode` column** — cleaner, but requires a migration.
3. **Derive from `tracking_tier`** — not appropriate; tier = frequency, not scope.

**Recommendation:** Use the existing `metadata` JSONB field to store `trackingMode` for the handful of identity-only accounts you'd flag. The adapter function reads `metadata?.trackingMode ?? "FULL_ARCHIVE"` (default all existing accounts to FULL_ARCHIVE). This avoids a schema migration and satisfies the "no new backend fields unless absolutely required" constraint. If the number of identity-only accounts grows, promote to a real column later.

---

### 3. Observed Since (`observedSince`)

**Verdict: Exists. Use `tracked_accounts.created_at`.**

- `tracked_accounts.created_at` (TIMESTAMPTZ, DEFAULT now()) records when the account was added to the tracking system.
- This is effectively "observed since" — when we started watching.
- No need for an expensive `MIN(tweets.captured_at)` query.

**Adapter:** `observedSince = account.createdAt`

---

### 4. Identity Metadata (`createdRegion`, `createdAt` for X account creation)

**Verdict: Not stored. Omit from UI.**

- `createdRegion` — not present anywhere in the schema or ingestion pipeline.
- X account creation date — not stored. The `metadata` JSONB could theoretically hold it, but no ingestion currently fetches it.
- SocialData API responses may include `created_at` for the account, but we'd need to check if it's in `raw_json` on tweets. That's a tweet-level field, not account-level.

**Recommendation:** Omit both fields from the UI. The spec already allows graceful omission ("If not present, UI should gracefully omit"). No new ingestion should be added. If a future seed script or manual process populates `metadata.xAccountCreatedAt`, the adapter can surface it then.

---

### 5. Stats Counters (`handleChanges`, `statements`, `deletions`)

**Verdict: Partially exists. Two of three are available cheaply.**

| Counter | Source | Cost |
|---------|--------|------|
| `statements` | `COUNT(*) FROM tweets WHERE account_id = ?` | Already computed on current page |
| `deletions` | `COUNT(*) FROM deletion_events WHERE account_id = ?` | Already computed on current page |
| `handleChanges` | **Not tracked.** No handle history table exists. | N/A |

**Handle changes:** There is no `handle_history` or `identity_changes` table. The `tracked_accounts.username` field holds only the current handle — no change log.

**Recommendation:**
- `statements` and `deletions`: Continue using the existing count queries. These are already cheap (indexed on `account_id`). Consider caching in `metadata` JSONB if they become expensive at scale, but not needed now.
- `handleChanges`: Display as `0` or omit entirely for now. To track handle changes going forward, you'd need either: (a) a `handle_history` table, or (b) a lightweight process that logs changes to `metadata` JSONB when username drift is detected. This is a future concern — the current codebase doesn't detect handle changes at all.
- **IDENTITY_ONLY accounts must skip the `statements` and `deletions` count queries entirely** — the adapter should short-circuit and return `null` for those counters.

---

### 6. Unified Event Model (`EventUI`)

**Verdict: Partially buildable from existing data. Some event types cannot be sourced.**

| Event Type | Source Table | Feasibility |
|------------|-------------|-------------|
| `STATEMENT_CAPTURED` | `tweets` (use `captured_at`) | Available |
| `STATEMENT_DELETED` | `deletion_events` (use `detected_at`) | Available |
| `HANDLE_CHANGED` | None | **Not available** — no handle history tracking exists |
| `METADATA_CHANGED` | None | **Not available** — no change log for metadata |
| `ATTESTED` | `hcs_attestations` joined with `tweets` | Available |

**Building the Activity feed:**
- Merge `tweets` (STATEMENT_CAPTURED), `deletion_events` (STATEMENT_DELETED), and `hcs_attestations` (ATTESTED) into a unified timeline sorted by timestamp.
- This requires a UNION-style query or multiple queries merged in application code. Application-level merge is simpler and avoids complex SQL.
- **Must be paginated** — don't load all events at once.

**HANDLE_CHANGED events:** Cannot be sourced today. Options:
1. **Skip for now** — Activity feed won't show handle changes.
2. **Prospective tracking only** — Add a lightweight check in the ingestion worker: if `fetched_username !== stored_username`, log the change to `metadata.handleHistory[]`. This is cheap (one string comparison per ingestion cycle, no new API calls).

**Recommendation:** Build Activity feed from the three available event types. Skip HANDLE_CHANGED and METADATA_CHANGED for initial implementation. Add prospective handle-change detection in the ingestion worker as a low-cost enhancement (comparison only, no new API calls). This satisfies "derive from handle history only if cheap."

---

### 7. Proof Links (`proofUrl`)

**Verdict: Exists. Reuse current routes.**

- Tweet proof page: `/tweet/[id]` — already shows HCS proof panel, content hash, transaction ID.
- Hash verification: `/verify/[hash]` — already allows public verification.
- `hcs_attestations` has `transaction_id` for Hashscan links.

**Adapter:** `proofUrl = /tweet/${tweet.id}` for statement/deletion events. For attestation events, link directly to `/tweet/${tweet.id}` which already renders the `HcsProofPanel`.

---

## Key Architecture Decisions

### Route: Keep `/accounts/[username]`

The spec proposes routing by `stableUserId`. The current route is `/accounts/[username]`.

**Recommendation: Keep `/accounts/[username]` as the primary route.**
- Human-readable, SEO-friendly, shareable.
- Handles are what users know.
- If a handle changes, add a redirect mechanism (look up old handles from prospective tracking).
- Display `twitter_id` in the Receipt Card for the technically-minded.

### Tab Architecture (5-tab SegmentedControl)

Current: 2 tabs (Tweets, Deletions) in a client component `AccountTabs`.
Proposed: 5 tabs (Activity, Statements, Deletions, Identity, Attestations).

**Recommendation:**
- Replace `AccountTabs` with a new `AccountSegmentedControl` component.
- **Lazy-load tab content** — only fetch data for the active tab. Currently the page fetches tweets AND deletions on every load. The refactored page should only fetch the default tab (Activity) initially.
- Statements and Deletions tabs reuse existing `TweetCard` and `RecentDeletionsFeed` components.
- Activity tab needs a new `ActivityFeed` component that merges event sources.
- Identity tab needs a new `IdentityTimeline` component (mostly empty until handle tracking is added).
- Attestations tab needs a new `AttestationsList` component querying `hcs_attestations`.
- Disabled tabs for IDENTITY_ONLY accounts render but are non-interactive with tooltip.

### Data Fetching Strategy

Current: Server component fetches everything in `Promise.all` on page load.
Proposed: Lazy tab loading.

**Recommendation:**
- Keep the page as a server component for SEO (Receipt Card, Account Header render server-side).
- Stats counters fetch server-side (cheap, needed for header).
- Tab content fetches client-side via API routes or server actions, triggered on tab switch.
- This requires new API endpoints or server actions for each tab's data.

---

## New Components Needed

| Component | Purpose | Complexity |
|-----------|---------|------------|
| `ReceiptCard` | Screenshotable citation block at top | Low — display-only, maps existing fields |
| `AccountSegmentedControl` | 5-tab control replacing `AccountTabs` | Medium — mode-aware enable/disable logic |
| `ActivityFeed` | Unified chronological event list | Medium — merges 3 data sources, pagination |
| `IdentityTimeline` | Handle history + metadata changes | Low for now — mostly empty placeholder |
| `AttestationsList` | List of HCS attestation records | Low — single table query, display |
| `TrackingModeBadge` | Visual chip for FULL_ARCHIVE / IDENTITY_ONLY | Trivial |

## Existing Components to Reuse

| Component | Used For |
|-----------|----------|
| `TweetCard` | Statements tab (existing tweet list) |
| `RecentDeletionsFeed` | Deletions tab (existing deletion list) |
| `HcsProofPanel` | Proof display in tweet detail page (pattern reuse) |
| `CategoryBadge`, `TierBadge` | Account Header (already used) |
| `LetterAvatar` | Account Header (already used) |

---

## Adapter Layer

A `toAccountUI()` adapter function should live in `apps/web/lib/adapters/account.ts`:

```typescript
function toAccountUI(account: TrackedAccountRow, stats: StatsRow): AccountUI {
  const metadata = account.metadata as Record<string, unknown> | null;
  return {
    stableUserId: account.twitterId,
    currentHandle: account.username,
    displayName: account.displayName ?? undefined,
    category: account.category,
    trackingMode: (metadata?.trackingMode as string) ?? "FULL_ARCHIVE",
    observedSince: account.createdAt.toISOString(),
    metadata: {
      createdRegion: metadata?.createdRegion as string | undefined,
      createdAt: metadata?.xAccountCreatedAt as string | undefined,
    },
    stats: {
      handleChanges: 0, // not tracked yet
      statements: stats.tweetCount,   // null for IDENTITY_ONLY
      deletions: stats.deletionCount,  // null for IDENTITY_ONLY
    },
  };
}
```

A `toEventUI()` adapter merges records from tweets, deletion_events, and hcs_attestations into the unified `EventUI` shape.

---

## Gaps and Risks Summary

| Gap | Impact | Mitigation |
|-----|--------|------------|
| No `tracking_mode` column | Cannot distinguish IDENTITY_ONLY accounts | Use `metadata` JSONB field; default all existing to FULL_ARCHIVE |
| No handle history table | Cannot show HANDLE_CHANGED events or handle change count | Add prospective detection in ingestion worker (zero-cost comparison); omit from UI until data accumulates |
| No `createdRegion` / X account `createdAt` | Cannot show identity metadata section | Gracefully omit; spec allows this |
| No stored counters (counts computed per-request) | Performance concern at scale | Current counts are indexed and fast for ~50-1000 accounts; cache later if needed |
| Route change to stableUserId | Breaks existing URLs, worse UX | Keep username-based route, display twitter_id in Receipt Card |
| Lazy tab loading requires new API endpoints | Additional implementation work | Use Next.js server actions or API routes; straightforward |
| Activity feed merges 3 tables | Pagination complexity | Application-level merge with cursor-based pagination |

---

## Overall Assessment

**The refactor is feasible and well-scoped.** The spec's core constraint — no new ingestion, no new paid API, no schema changes — is largely achievable.

### Key Findings

1. **80% of the UI contract maps directly to existing data** — stableUserId, observedSince, statements count, deletions count, proof links all map 1:1.
2. **The 20% gap is handle/identity tracking** — no handle history exists, so HANDLE_CHANGED events, handleChanges counter, and the Identity tab will be thin until prospective tracking is added.
3. **trackingMode must be introduced** but can live in the existing `metadata` JSONB column, requiring zero schema migration.
4. **The biggest implementation effort is the Activity feed** — merging three data sources with pagination. This is application code, not backend cost.
5. **The route should stay as `/accounts/[username]`** — changing to stableUserId hurts UX with no real benefit.

### Recommended Implementation Order

1. Adapter layer (`toAccountUI`, `toEventUI`) + types
2. ReceiptCard component
3. AccountSegmentedControl (replace AccountTabs)
4. Statements + Deletions tabs (reuse existing components, add lazy loading)
5. AttestationsList tab
6. ActivityFeed tab (unified merge + pagination)
7. IdentityTimeline tab (placeholder-ready)
8. IDENTITY_ONLY mode gating (disable tabs, skip queries)
9. Prospective handle-change detection in ingestion worker (optional, low-cost)
