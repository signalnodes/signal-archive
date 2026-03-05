# Atomic Batch Donations — Implementation Plan

> **Context**: Hedera Hackathon entry for Signal Archive
> **Goal**: Replace the current donate-then-verify flow with a single atomic batch transaction that combines donation transfer + NFT supporter badge + HCS public receipt.
> **Date**: 2026-03-05

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture (As-Is)](#2-current-architecture-as-is)
3. [Feasibility Assessment](#3-feasibility-assessment)
4. [Target Architecture (To-Be)](#4-target-architecture-to-be)
5. [Transaction Design](#5-transaction-design)
6. [Signing Flow — Server-Orchestrated Batch](#6-signing-flow--server-orchestrated-batch)
7. [NFT Supporter Badge Design](#7-nft-supporter-badge-design)
8. [HCS Donation Receipt Design](#8-hcs-donation-receipt-design)
9. [Dynamic Pricing ($5 USD Threshold)](#9-dynamic-pricing-5-usd-threshold)
10. [Database Schema Changes](#10-database-schema-changes)
11. [API Changes](#11-api-changes)
12. [Client-Side Changes](#12-client-side-changes)
13. [New Environment Variables](#13-new-environment-variables)
14. [File-by-File Change List](#14-file-by-file-change-list)
15. [One-Time Setup Steps](#15-one-time-setup-steps)
16. [Implementation Order (Critical Path)](#16-implementation-order-critical-path)
17. [Risks & Fallbacks](#17-risks--fallbacks)
18. [Hackathon Pitch Points](#18-hackathon-pitch-points)

---

## 1. Executive Summary

The current donation flow is a two-phase process: the client builds a `TransferTransaction`, the user signs it via WalletConnect, and then the server verifies the transfer via mirror node post-hoc. The supporter badge is UI-only (a green `<Badge>` component) — not an on-chain asset. There is no HCS receipt for donations. The donation verify flow is also noted as broken in production.

The new architecture replaces this with a **single Hedera Atomic Batch Transaction (HIP-551)** containing up to 3 inner transactions executed atomically:

1. **Transfer** — HBAR or USDC from donor to treasury
2. **NFT Mint** — Soulbound supporter badge (only if threshold met and not already owned)
3. **HCS Message** — Public donation receipt to a dedicated topic

If any step fails, the entire batch rolls back. No partial states.

This demonstrates **HTS (token transfers + NFT minting) + HCS (public receipts) + Atomic Batch Transactions (HIP-551)** — three Hedera services in one atomic operation.

---

## 2. Current Architecture (As-Is)

### Flow
```
Client                          Server                    Hedera
  │                               │                         │
  │ buildHbarTransfer()           │                         │
  │ signAndExecuteTransaction() ──────────────────────────► │ TransferTransaction
  │                               │                         │
  │ POST /api/donations/verify ──►│                         │
  │                               │ verifyDonationTransaction()
  │                               │ ◄──── Mirror Node ─────►│
  │                               │ INSERT donations        │
  │                               │ UPSERT supporters       │
  │ ◄──── { status: confirmed } ──│                         │
```

### Key Files
| File | Role |
|------|------|
| `apps/web/lib/wallet/donate.ts` | Builds TransferTransaction, calls WC signAndExecuteTransaction, retries verify |
| `apps/web/lib/wallet/connector.ts` | DAppConnector setup (WalletConnect, HashPack/Kabila featured) |
| `apps/web/lib/wallet/context.tsx` | WalletProvider: accountId, isSupporter, connect/disconnect |
| `apps/web/lib/wallet/constants.ts` | DONATION_ACCOUNT_ID, USDC_TOKEN_ID, etc. |
| `apps/web/lib/wallet/hedera-mirror.ts` | verifyDonationTransaction via mirror node REST |
| `apps/web/lib/supporter-cache.ts` | In-memory supporter cache, MIN_HBAR=50, MIN_USDC=5 |
| `apps/web/app/api/donations/verify/route.ts` | POST handler: verify via mirror, insert donation + supporter |
| `apps/web/components/donation-card.tsx` | Donation UI: asset toggle, amount presets, flow states |
| `apps/web/components/supporter-badge.tsx` | UI-only emerald badge |
| `packages/db/src/schema/donations.ts` | donations table |
| `packages/db/src/schema/supporters.ts` | supporters table |

### Problems Solved by This Overhaul
- **Donation verify is broken in production** — supporters table only populated manually
- **No on-chain proof of support** — badge is purely cosmetic
- **No donation receipts on HCS** — missed opportunity for transparency
- **Partial failure states** — donation can succeed without badge, or vice versa
- **Fixed thresholds** — 50 HBAR doesn't track $5 USD as HBAR price changes

---

## 3. Feasibility Assessment

### HIP-551 SDK Support ✅
- `BatchTransaction` merged into `@hashgraph/sdk` / `@hiero-ledger/sdk` in **v2.64.0** (April 2025)
- Project uses `@hashgraph/sdk` ^2.80.0 — well past the required version
- GitHub issue [hiero-sdk-js#2878](https://github.com/hiero-ledger/hiero-sdk-js/issues/2878) — **CLOSED/COMPLETED**

### WalletConnect + Batch ⚠️
- `@hashgraph/hedera-wallet-connect` does NOT explicitly document `BatchTransaction` support
- However, `signTransaction` works by serializing any Transaction subclass to base64 protobuf
- The server-orchestrated approach sidesteps this entirely: wallet only signs the inner transfer, server assembles and executes the batch
- `signTransaction` (sign-only, no execute) is documented and supported

### Multi-Signer Requirement ⚠️
- The batch includes operations requiring **different signers**:
  - Transfer → user's wallet key
  - NFT Mint → operator's supply key
  - HCS Submit → operator's submit key
- Solution: **Server-orchestrated batch** — operator pre-signs their portions, user signs transfer via WC `signTransaction`, server assembles full batch and executes via `@hashgraph/sdk` `Client`

### Mirror Node Batch Support ✅
- Mirror Node v0.128.0+ supports batch transactions
- `/api/v1/transactions/{id}` returns inner transactions with `parentConsensusTimestamp`
- Existing verify logic can be adapted to check batch parent transaction

---

## 4. Target Architecture (To-Be)

### Flow
```
Client                          Server (API Route)         Hedera
  │                               │                         │
  │ POST /api/donations/prepare ─►│                         │
  │   { accountId, asset, amount }│                         │
  │                               │ Validate params         │
  │                               │ Check badge ownership   │
  │                               │ Fetch HBAR/USD rate     │
  │                               │ Build inner transactions│
  │                               │ batchify() each         │
  │                               │ Operator signs HCS+Mint │
  │                               │ Serialize user's inner  │
  │ ◄── { userTxBase64,          │ transfer for signing    │
  │       batchId, template }     │                         │
  │                               │                         │
  │ signTransaction(userTxBase64)─────────────────────────► │ (wallet signs)
  │                               │                         │
  │ POST /api/donations/execute ─►│                         │
  │   { batchId, signedTxBase64 } │                         │
  │                               │ Reassemble batch        │
  │                               │ Execute BatchTransaction│
  │                               │ ───────────────────────►│ ATOMIC:
  │                               │                         │  1. Transfer
  │                               │                         │  2. Mint NFT
  │                               │                         │  3. HCS Receipt
  │                               │ Get receipts            │
  │                               │ INSERT donations        │
  │                               │ UPSERT supporters       │
  │ ◄── { status, txId, badgeSerial, receiptSeq } ────────│
```

### Key Architectural Decision: Two-Phase API

The donation becomes a **two-round-trip** process:

1. **`POST /api/donations/prepare`** — Server builds the batch, operator signs its portions, returns the user's inner transfer (unsigned) for wallet signing
2. **`POST /api/donations/execute`** — Client sends back the user-signed transfer, server reassembles the complete batch and executes it

This is necessary because:
- The operator must sign HCS and NFT mint (server-side keys)
- The user must sign the transfer (wallet-side key)
- `BatchTransaction` requires all inner transactions to be `batchify()`'d before signing
- The batch payer (operator) signs the outer `BatchTransaction` itself

---

## 5. Transaction Design

### Template A — Donation Only (below threshold)

When `amount < $5 USD equivalent`:

| # | Transaction Type | Signer | Purpose |
|---|---|---|---|
| 1 | `TransferTransaction` | User wallet | Transfer HBAR/USDC to treasury |
| 2 | `TopicMessageSubmitTransaction` | Operator | Publish donation receipt to HCS |

### Template B — Donation + Supporter Badge (meets threshold)

When `amount >= $5 USD equivalent` AND user does NOT already own badge:

| # | Transaction Type | Signer | Purpose |
|---|---|---|---|
| 1 | `TransferTransaction` | User wallet | Transfer HBAR/USDC to treasury |
| 2 | `TokenMintTransaction` | Operator (supply key) | Mint new NFT badge serial |
| 3 | `TransferTransaction` | Operator (treasury of badge token) | Transfer minted badge to user |
| 4 | `TopicMessageSubmitTransaction` | Operator | Publish donation receipt to HCS |

> **Note**: Template B needs a separate transfer after mint because the mint goes to the token treasury. We transfer the newly minted serial to the user's account. Alternatively, the user can be the token treasury, but that's more complex. The simpler approach: mint to operator treasury, then transfer to user.

### Template C — Donation + Threshold Met + Badge Already Owned

Falls back to **Template A**. The HCS receipt records `supporter_awarded: false, badge_already_owned: true`.

---

## 6. Signing Flow — Server-Orchestrated Batch

### Detailed Step-by-Step

```
PREPARE PHASE (POST /api/donations/prepare):

1. Server receives { accountId, asset, amount }
2. Server validates:
   - accountId format (0.0.XXXXX)
   - asset is "hbar" or "usdc"
   - amount > 0
3. Server determines template:
   a. Fetch HBAR/USD rate (if asset=hbar) from cache/API
   b. Calculate USD equivalent
   c. Check if amount >= threshold ($5)
   d. If threshold met: query mirror node for NFT badge ownership
   e. Select Template A, B, or C
4. Server generates a batch key (PrivateKey.generateED25519())
5. Server builds inner transactions:
   a. TransferTransaction (user → treasury)
      - .batchify(client, batchKey)
      - NOT signed yet (user must sign)
   b. [Template B only] TokenMintTransaction
      - .batchify(client, batchKey)
      - Sign with operator supply key
   c. [Template B only] TransferTransaction (badge: treasury → user)
      - .batchify(client, batchKey)
      - Sign with operator key
   d. TopicMessageSubmitTransaction
      - .batchify(client, batchKey)
      - Sign with operator key
6. Server stores batch state in memory/Redis:
   - batchId (UUID)
   - All signed inner transactions (serialized)
   - The unsigned user transfer (serialized)
   - batchKey
   - Template type
   - Expiry (5 minutes)
7. Server returns to client:
   - batchId
   - userTransactionBase64 (the transfer tx, batchified but unsigned)
   - template ("donation_only" | "donation_badge")
   - thresholdMet: boolean
   - estimatedUsd: number (if HBAR)

SIGN PHASE (Client):

8. Client calls WalletConnect signTransaction():
   - connector.signTransaction({ signerAccountId, transactionList: userTransactionBase64 })
   - User approves in HashPack/Kabila
   - Returns signed transaction bytes

EXECUTE PHASE (POST /api/donations/execute):

9. Server receives { batchId, signedTransactionBase64 }
10. Server retrieves batch state from memory/Redis
11. Server deserializes the user-signed transfer
12. Server builds BatchTransaction:
    - .addInnerTransaction(userSignedTransfer)
    - .addInnerTransaction(operatorSignedMint)     [Template B]
    - .addInnerTransaction(operatorSignedBadgeTx)  [Template B]
    - .addInnerTransaction(operatorSignedHcsMsg)
13. Server signs BatchTransaction with batch key
14. Server executes: batchTx.execute(client)
15. Server gets receipt: batchResp.getReceipt(client)
16. Server checks each inner transaction receipt
17. Server records to DB:
    - INSERT INTO donations (confirmed immediately — no mirror node delay)
    - UPSERT INTO supporters (if threshold met)
18. Server returns:
    - { status: "confirmed", transactionId, badgeSerial?, hcsSequenceNumber }
```

### Why Not Client-Execute?

1. WalletConnect `signAndExecuteTransaction` might not handle `BatchTransaction` (undocumented)
2. Even if it did, the operator's inner transactions are pre-signed server-side — the client would need to somehow combine them
3. Server execution gives us immediate confirmation without mirror node polling
4. The operator already has the client connected and the SDK `Client` configured

---

## 7. NFT Supporter Badge Design

### Token Properties

| Property | Value |
|---|---|
| Type | Non-Fungible Token (NFT) |
| Name | Signal Archive Supporter |
| Symbol | SAS |
| Max Supply | Unlimited (or high cap like 1,000,000) |
| Supply Key | Operator key (for minting) |
| Treasury | Operator account |
| Admin Key | Operator key (for future management) |
| Freeze Key | Operator key (for soulbound behavior — optional) |
| Transfer | Initially transferable; optionally use freeze to make soulbound |
| Metadata per serial | `{ donation_amount, asset, usd_equivalent, threshold_used, timestamp }` |

### One-Time Token Creation

Run via a setup script (`scripts/create-badge-token.ts`):

```typescript
const tx = new TokenCreateTransaction()
  .setTokenName("Signal Archive Supporter")
  .setTokenSymbol("SAS")
  .setTokenType(TokenType.NonFungibleUnique)
  .setSupplyType(TokenSupplyType.Infinite)
  .setTreasuryAccountId(operatorId)
  .setSupplyKey(operatorKey)
  .setAdminKey(operatorKey)
  .setFreezeKey(operatorKey)  // optional: for soulbound
  .execute(client);
```

### Soulbound Strategy (Optional Enhancement)

True soulbound NFTs on Hedera use the freeze approach:
1. Mint badge → treasury
2. Transfer badge → user
3. Freeze user's account for this token → prevents transfer

This can be a 4th inner transaction in the batch. For hackathon, transferable is fine — soulbound is a polish item.

### Duplicate Prevention

Before constructing Template B, the server checks badge ownership:

```typescript
// Mirror node: check if user owns any serial of the badge token
const res = await fetch(
  `${MIRROR_BASE}/api/v1/accounts/${accountId}/nfts?token.id=${BADGE_TOKEN_ID}&limit=1`
);
const data = await res.json();
const alreadyOwns = data.nfts?.length > 0;
```

If already owns → fall back to Template A (donation + receipt only).

### Token Association

**Important**: The user must have the badge token associated with their account before receiving the NFT. Options:

1. **Auto-association** — If the user's account has available auto-association slots (most wallets set some by default), the transfer will auto-associate. This is the simplest approach.
2. **Add TokenAssociateTransaction to batch** — As another inner transaction, signed by the user. More reliable but adds complexity.
3. **Prompt user to associate first** — Bad UX, not recommended.

**Recommendation for hackathon**: Rely on auto-association. If it fails (user has no auto-association slots), the entire batch fails atomically — no partial state. The UI can show an error suggesting the user enable auto-association in their wallet. This is acceptable for a hackathon.

---

## 8. HCS Donation Receipt Design

### New Topic

Create a dedicated HCS topic for donation receipts (separate from tweet attestation topic `0.0.10301350` and research topic `0.0.10307943`).

```
HEDERA_DONATION_TOPIC_ID=0.0.XXXXXXX
```

Submit-key locked to operator (same pattern as existing topics).

### Message Schema

```json
{
  "version": 1,
  "type": "donation_receipt",
  "donor_account": "0.0.12345",
  "asset": "HBAR",
  "amount": 100,
  "amount_usd": 5.25,
  "supporter_awarded": true,
  "badge_already_owned": false,
  "badge_token_id": "0.0.XXXXX",
  "badge_serial": 42,
  "threshold_usd": 5,
  "rate_hbar_usd": 0.0525,
  "template": "donation_badge",
  "timestamp": "2026-03-05T12:00:00Z"
}
```

### Why a Separate Topic?

- Tweet attestations are high-volume (thousands/day at scale)
- Donation receipts are low-volume (occasional)
- Different audiences: tweet attestations are for verification, donation receipts are for transparency
- Separate topics = cleaner HashScan browsing for hackathon judges

---

## 9. Dynamic Pricing ($5 USD Threshold)

### HBAR/USD Rate Source

Use CoinGecko's free API (no key required, 10-30 req/min):

```
GET https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd
→ { "hedera-hashgraph": { "usd": 0.0525 } }
```

### Caching Strategy

- **Server-side cache**: 10-minute TTL
- Stored in module-level variable (same pattern as supporter-cache.ts)
- Fallback: if API fails, use last known rate; if no rate ever fetched, use hardcoded fallback (e.g., $0.05)

### Threshold Logic

```typescript
const SUPPORTER_THRESHOLD_USD = 5;

function meetsThreshold(asset: "hbar" | "usdc", amount: number, hbarRate: number): boolean {
  if (asset === "usdc") return amount >= SUPPORTER_THRESHOLD_USD;
  return (amount * hbarRate) >= SUPPORTER_THRESHOLD_USD;
}
```

### Client-Side Display

The donation card should show the dynamic equivalent:
- "50 HBAR ≈ $2.63" (if rate = $0.0525)
- Threshold indicator: "Supporter badge awarded at $5+ donations"
- If HBAR selected: show how much HBAR needed for badge

### Promotional Threshold (Future)

Not needed for hackathon MVP. The schema supports it via config:
```typescript
const PROMO_THRESHOLD_USD = 1; // set to null when inactive
const PROMO_EXPIRES = new Date("2026-04-01");
```

---

## 10. Database Schema Changes

### Modified: `donations` table

Add columns:

```sql
ALTER TABLE donations ADD COLUMN amount_usd NUMERIC(12,2);          -- already exists
ALTER TABLE donations ADD COLUMN hbar_rate NUMERIC(12,6);            -- NEW: rate used for conversion
ALTER TABLE donations ADD COLUMN template TEXT;                       -- NEW: 'donation_only' | 'donation_badge'
ALTER TABLE donations ADD COLUMN badge_serial INTEGER;               -- NEW: NFT serial if badge awarded
ALTER TABLE donations ADD COLUMN hcs_sequence_number BIGINT;         -- NEW: HCS receipt seq number
ALTER TABLE donations ADD COLUMN batch_transaction_id TEXT;           -- NEW: outer batch tx ID
```

### Modified: `supporters` table

Add columns:

```sql
ALTER TABLE supporters ADD COLUMN badge_token_id TEXT;               -- NEW: HTS badge token ID
ALTER TABLE supporters ADD COLUMN badge_serial INTEGER;              -- NEW: NFT serial number
ALTER TABLE supporters ADD COLUMN badge_awarded_at TIMESTAMPTZ;      -- NEW: when badge was minted
```

### Drizzle Schema Updates

**`packages/db/src/schema/donations.ts`** — add `hbarRate`, `template`, `badgeSerial`, `hcsSequenceNumber`, `batchTransactionId`

**`packages/db/src/schema/supporters.ts`** — add `badgeTokenId`, `badgeSerial`, `badgeAwardedAt`

---

## 11. API Changes

### NEW: `POST /api/donations/prepare`

**Request:**
```json
{
  "accountId": "0.0.12345",
  "asset": "hbar",
  "amount": 100
}
```

**Response:**
```json
{
  "batchId": "uuid",
  "userTransactionBytes": "base64...",
  "template": "donation_badge",
  "thresholdMet": true,
  "badgeAlreadyOwned": false,
  "estimatedUsd": 5.25,
  "hbarRate": 0.0525,
  "expiresAt": "2026-03-05T12:05:00Z"
}
```

**Server-side logic:**
1. Validate inputs
2. Fetch HBAR rate (if needed)
3. Check badge ownership via mirror node
4. Build inner transactions, batchify, operator-sign
5. Store batch state (Redis or in-memory Map with TTL)
6. Return user's unsigned transfer for wallet signing

### NEW: `POST /api/donations/execute`

**Request:**
```json
{
  "batchId": "uuid",
  "signedTransactionBytes": "base64..."
}
```

**Response:**
```json
{
  "status": "confirmed",
  "transactionId": "0.0.XXXX@XXXXXXXXX-XXXXXXXXX",
  "template": "donation_badge",
  "badgeSerial": 42,
  "hcsSequenceNumber": 7,
  "amountUsd": 5.25
}
```

**Server-side logic:**
1. Retrieve batch state
2. Deserialize user-signed transfer
3. Assemble BatchTransaction with all inner txs
4. Sign with batch key, execute
5. Get receipts for each inner tx
6. Record to DB (donations + supporters)
7. Return confirmation

### MODIFIED: `GET /api/supporters/[walletAddress]`

Add `badgeSerial` and `badgeTokenId` to response for UI display.

### DEPRECATED: `POST /api/donations/verify`

No longer needed — the server executes the transaction directly and records to DB immediately. Keep the endpoint temporarily for backwards compatibility but it becomes a no-op.

### NEW: `GET /api/donations/rate`

Returns current HBAR/USD rate for the client-side donation card to show estimates.

```json
{
  "hbarUsd": 0.0525,
  "cachedAt": "2026-03-05T12:00:00Z",
  "thresholdUsd": 5,
  "hbarForThreshold": 95.24
}
```

---

## 12. Client-Side Changes

### `apps/web/lib/wallet/donate.ts` — Major Rewrite

Replace `submitDonation()` entirely:

```typescript
// OLD: buildTransfer → signAndExecute → verifyWithRetries
// NEW: prepare → signTransaction → execute

export async function submitDonation(
  accountId: string,
  asset: "hbar" | "usdc",
  amount: number,
): Promise<DonationResult> {
  // 1. Call prepare endpoint
  const prepareRes = await fetch("/api/donations/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, asset, amount }),
  });
  const prepareData = await prepareRes.json();

  // 2. Sign the user's inner transfer via WalletConnect
  const connector = await getConnector();
  const signerAccountId = `hedera:${HEDERA_NETWORK}:${accountId}`;
  const signResult = await connector.signTransaction({
    signerAccountId,
    transactionList: prepareData.userTransactionBytes,
  });

  // 3. Execute the batch
  const executeRes = await fetch("/api/donations/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      batchId: prepareData.batchId,
      signedTransactionBytes: signResult.result,
    }),
  });
  const executeData = await executeRes.json();

  return {
    success: executeData.status === "confirmed",
    transactionId: executeData.transactionId,
    template: executeData.template,
    badgeSerial: executeData.badgeSerial,
    hcsSequenceNumber: executeData.hcsSequenceNumber,
  };
}
```

Delete: `buildHbarTransfer()`, `buildUsdcTransfer()`, `verifyWithRetries()` — all superseded.

### `apps/web/lib/wallet/constants.ts`

Add:
```typescript
export const BADGE_TOKEN_ID = process.env.NEXT_PUBLIC_BADGE_TOKEN_ID ?? "";
```

### `apps/web/components/donation-card.tsx`

Changes:
1. **Show dynamic HBAR threshold**: fetch `/api/donations/rate` on mount, display "≈ $X.XX" next to HBAR amounts
2. **Update presets**: instead of fixed [50, 100, 250, 500] HBAR, calculate based on rate (e.g., ~$5, ~$10, ~$25, ~$50 in HBAR)
3. **Show "Supporter Badge" indicator**: "Donations of $5+ earn an on-chain Supporter Badge NFT"
4. **Update flow states**: add "preparing" state between "signing" and "confirming"
5. **Show badge info in success state**: display badge serial, link to HashScan

### `apps/web/components/supporter-badge.tsx`

Enhance to optionally show NFT serial number and link to HashScan NFT viewer.

### `apps/web/lib/wallet/context.tsx`

Add `badgeSerial` to WalletState, returned from `/api/supporters/[address]`.

### `apps/web/lib/supporter-cache.ts`

- Remove hardcoded `MIN_HBAR = 50` and `MIN_USDC = 5`
- Replace with dynamic `SUPPORTER_THRESHOLD_USD = 5`
- Threshold calculation moves to the prepare endpoint

---

## 13. New Environment Variables

Add to `.env.example`:

```bash
# Supporter Badge NFT
NEXT_PUBLIC_BADGE_TOKEN_ID=               # HTS NFT token ID for supporter badges
BADGE_TOKEN_SUPPLY_KEY=                    # Supply key for minting (can be same as HEDERA_OPERATOR_KEY)

# Donation HCS Topic
HEDERA_DONATION_TOPIC_ID=                  # HCS topic for donation receipts

# Pricing
HBAR_RATE_FALLBACK=0.05                   # Fallback HBAR/USD rate if API unavailable
SUPPORTER_THRESHOLD_USD=5                  # Minimum donation in USD for supporter badge
```

**Note**: `BADGE_TOKEN_SUPPLY_KEY` can be the same as `HEDERA_OPERATOR_KEY` for simplicity. Only separate them if you want distinct key management.

---

## 14. File-by-File Change List

### New Files

| File | Purpose |
|------|---------|
| `apps/web/app/api/donations/prepare/route.ts` | Prepare endpoint — build batch, operator-sign, return user tx |
| `apps/web/app/api/donations/execute/route.ts` | Execute endpoint — reassemble batch, execute, record to DB |
| `apps/web/app/api/donations/rate/route.ts` | HBAR/USD rate endpoint |
| `apps/web/lib/wallet/batch-store.ts` | In-memory or Redis store for pending batch state (TTL: 5min) |
| `apps/web/lib/wallet/hbar-rate.ts` | HBAR/USD rate fetching + caching |
| `apps/web/lib/wallet/badge-check.ts` | Mirror node badge ownership check |
| `scripts/create-badge-token.ts` | One-time: create supporter NFT token on Hedera |
| `scripts/create-donation-topic.ts` | One-time: create HCS donation receipt topic |

### Modified Files

| File | Changes |
|------|---------|
| `apps/web/lib/wallet/donate.ts` | **Rewrite**: replace signAndExecute flow with prepare/sign/execute |
| `apps/web/lib/wallet/constants.ts` | Add BADGE_TOKEN_ID |
| `apps/web/lib/wallet/context.tsx` | Add badgeSerial to state, fetch from supporters API |
| `apps/web/lib/wallet/hedera-mirror.ts` | Add badge ownership check function; update MIRROR_BASE to support testnet |
| `apps/web/lib/supporter-cache.ts` | Remove hardcoded thresholds, add dynamic threshold |
| `apps/web/components/donation-card.tsx` | Dynamic presets, threshold indicator, "preparing" state, badge info in success |
| `apps/web/components/supporter-badge.tsx` | Optional NFT serial display |
| `apps/web/app/api/supporters/[walletAddress]/route.ts` | Return badge info |
| `packages/db/src/schema/donations.ts` | Add hbarRate, template, badgeSerial, hcsSequenceNumber, batchTransactionId |
| `packages/db/src/schema/supporters.ts` | Add badgeTokenId, badgeSerial, badgeAwardedAt |
| `.env.example` | Add new env vars |

### Deprecated (keep but unused)

| File | Notes |
|------|-------|
| `apps/web/app/api/donations/verify/route.ts` | No longer called; keep for backwards compat or delete |

---

## 15. One-Time Setup Steps

Before the new code works, these manual/scripted steps are needed:

### 1. Create Supporter Badge NFT Token

```bash
npx tsx scripts/create-badge-token.ts
# → Outputs: Badge Token ID: 0.0.XXXXXXX
# → Set NEXT_PUBLIC_BADGE_TOKEN_ID in .env
```

### 2. Create Donation HCS Topic

```bash
npx tsx scripts/create-donation-topic.ts
# → Outputs: Donation Topic ID: 0.0.XXXXXXX
# → Set HEDERA_DONATION_TOPIC_ID in .env
```

### 3. Run Database Migration

```bash
npm run db:generate
npm run db:migrate
```

### 4. Update .env

Add new variables to Railway/production env.

---

## 16. Implementation Order (Critical Path)

### Phase 1: Foundation (Day 1)

1. **DB schema changes** — add columns to donations + supporters tables, generate migration
2. **Create setup scripts** — `create-badge-token.ts`, `create-donation-topic.ts`
3. **Run setup scripts on testnet** — get token ID and topic ID
4. **HBAR rate service** — `hbar-rate.ts` with CoinGecko fetch + cache
5. **Badge check utility** — `badge-check.ts` mirror node query

### Phase 2: Server-Side Batch Construction (Day 2)

6. **Batch store** — `batch-store.ts` (in-memory Map with 5min TTL)
7. **`POST /api/donations/prepare`** — the core endpoint: validate, build inner txs, batchify, operator-sign, store, return
8. **`POST /api/donations/execute`** — reassemble, execute, record
9. **`GET /api/donations/rate`** — expose rate to client

### Phase 3: Client-Side Integration (Day 3)

10. **Rewrite `donate.ts`** — prepare → sign → execute flow
11. **Update `donation-card.tsx`** — dynamic thresholds, new flow states, badge info
12. **Update `context.tsx`** — badge info in wallet state
13. **Update `supporter-badge.tsx`** — NFT serial display

### Phase 4: Polish & Test (Day 4)

14. **End-to-end test on testnet** — full flow with HashPack
15. **Error handling** — batch expiry, wallet rejection, auto-association failure
16. **UI polish** — success screen with HashScan links, badge animation
17. **Deploy setup scripts to mainnet** — create real token + topic
18. **Update ARCHITECTURE.md** — document new flow

---

## 17. Risks & Fallbacks

### Risk 1: `signTransaction` doesn't return properly serialized bytes for batchified tx

**Likelihood**: Medium — WalletConnect's signTransaction serializes using protobuf, but batchified txs have special fields (batch key, node 0.0.0).

**Fallback**: If the wallet can't sign the batchified inner tx, try:
- Use `signAndExecuteTransaction` for just the transfer (old flow)
- Server executes the HCS + badge as a separate batch (non-atomic but still grouped)
- Label it "coordinated transaction" for hackathon — still demonstrates batch concept

### Risk 2: Auto-association fails for badge transfer

**Likelihood**: Low-Medium — depends on user's wallet auto-association settings.

**Fallback**:
- Add `TokenAssociateTransaction` as an additional inner tx signed by user
- Or: prompt user to associate the badge token in their wallet first
- Or: skip badge transfer, just mint it to treasury and record the serial in DB (badge exists on-chain, user can claim later)

### Risk 3: CoinGecko rate API goes down

**Likelihood**: Low

**Fallback**: Hardcoded fallback rate ($0.05). The rate used is recorded in the HCS receipt, so it's transparent.

### Risk 4: Batch construction is slow (>5s) causing UX lag

**Likelihood**: Low — Hedera SDK operations are fast.

**Fallback**: Show a clear "Preparing transaction..." spinner during prepare phase.

### Risk 5: Redis not available for batch store

**Likelihood**: Low (already using Redis for BullMQ)

**Fallback**: Use in-memory Map store. For a single-instance hackathon demo, this is fine. Race conditions only matter at scale.

### Risk 6: @hashgraph/sdk BatchTransaction API differs from documentation

**Likelihood**: Low — SDK v2.64.0+ confirmed, feature is closed/shipped.

**Fallback**: Check SDK source/types at build time. If API is slightly different, adapt.

---

## 18. Hackathon Pitch Points

This architecture demonstrates:

1. **Atomic Batch Transactions (HIP-551)** — the headline feature. Multiple Hedera operations in one all-or-nothing transaction.

2. **Three Hedera services in one atomic operation**:
   - **HTS Token Transfer** — donation payment
   - **HTS NFT Minting** — supporter badge issuance
   - **HCS Message** — public donation receipt

3. **No smart contracts needed** — pure Hedera-native primitives. Simpler, cheaper, and more elegant than a Solidity contract.

4. **Eliminates partial failure states** — impossible to have payment without badge, or badge without receipt. Trustless guarantee.

5. **Public transparency** — every donation receipt is on HCS, publicly verifiable via HashScan.

6. **Soulbound NFT badges** — on-chain proof of support (with optional freeze for true soulbound behavior).

7. **Dynamic pricing** — $5 USD threshold works regardless of HBAR price fluctuation, with rate recorded in receipt.

8. **Real production app** — Signal Archive is live, handling real accounts and real tweets. This isn't a hackathon toy project.

---

## Sources

- [HIP-551: Batch Transactions](https://hips.hedera.com/hip/hip-551)
- [Create a Batch Transaction — Hedera Docs](https://docs.hedera.com/hedera/sdks-and-apis/sdks/transactions/create-a-batch-transaction)
- [Unlocking New Possibilities with Hedera Batch Transactions](https://hedera.com/blog/unlocking-new-possibilities-with-hedera-batch-transactions/)
- [hiero-sdk-js HIP-551 Issue #2878](https://github.com/hiero-ledger/hiero-sdk-js/issues/2878) — CLOSED/COMPLETED (v2.64.0)
- [@hashgraph/hedera-wallet-connect](https://github.com/hashgraph/hedera-wallet-connect)
- [HIP-820: WalletConnect Integration](https://hips.hedera.com/HIP/hip-820.html)
