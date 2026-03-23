# Signal Archive

**Cryptographic proof of public statements on Hedera.**

Signal Archive monitors high-value public figures on X/Twitter, archives every tweet, and submits a cryptographic attestation to a public Hedera HCS topic in near real-time. When a tweet is deleted, the deletion is also attested on-chain. The result: immutable, independently verifiable proof of what was said and when.

**Live now at [signalarchive.org](https://signalarchive.org)**

---

## Hedera Hello Future: Apex Hackathon 2026

Signal Archive is submitted to the **Open Track** of the Hello Future Apex Hackathon.

### Hedera Integration

- **HCS Topic `0.0.10301350`** (mainnet) - tweet attestations and deletion records
- **HCS Topic `0.0.10310903`** (mainnet) - donation receipts via HIP-551 atomic batch
- **HCS-2 Topic Registry `0.0.10388911`** (mainnet) - standardized machine-readable registry of all Signal Archive HCS topics, independently discoverable at [signalarchive.org/registry](https://signalarchive.org/registry)
- **HIP-551 Atomic Batch** - donation flow bundles HCS submission + optional NFT mint into a single atomic transaction
- **HIP-657 dNFT** - supporter badge NFTs with dynamic metadata (`0.0.10314265`)
- **3,000+ messages** live on mainnet as of March 2026

### Verify It Yourself

Every attestation is publicly readable on HashScan:

1. Visit [signalarchive.org](https://signalarchive.org)
2. Open any archived tweet
3. Click **"View Proof"**
4. Follow the HashScan link - no trust required

---

## How It Works

### 1. Capture
A tier-based ingestion daemon continuously monitors 40 high-value accounts. Priority accounts (Trump family, active controversy figures) are checked every hour. Standard accounts every four hours. Every new tweet is archived to PostgreSQL.

### 2. Hash
A SHA-256 hash is computed from a canonical JSON representation of the tweet (content, author ID, timestamp, media URLs, tweet type). The hash is deterministic and reproducible by anyone with the original tweet data.

### 3. Attest
The hash is submitted to Hedera HCS topic `0.0.10301350`. Hedera reaches consensus in seconds. The attestation is permanent, public, and timestamped.

### 4. Detect Deletions
A deletion detection worker checks archived tweets against X's oEmbed API on a regular cycle. When a tweet returns 404, it is flagged as deleted and a second HCS attestation is submitted confirming the deletion.

### 5. Score
Claude AI scores each deletion on a 1-10 public interest severity scale, separating mundane corrections from politically significant removals. A heuristic fallback ensures scoring works without API access.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui |
| Database | PostgreSQL 16 (Neon), Drizzle ORM |
| Job Queue | BullMQ + Redis |
| Blockchain | @hashgraph/sdk - HCS, HIP-551, HIP-657, NFT minting |
| AI | Claude AI (Anthropic) - deletion severity scoring |
| Ingestion | Headless Chrome (CDP), tier-based cron scheduling |
| Hosting | Railway (web), Hetzner VPS (worker, ingestion, Chrome) |
| DNS/CDN | Cloudflare |

## Monorepo Structure

```
signal-archive/
  apps/
    web/          - Next.js frontend + API routes
    worker/       - BullMQ job consumers (deletion detection, HCS, ingestion)
  packages/
    db/           - Drizzle schema + migrations
    shared/       - Types, canonical hash, constants
  scripts/        - Operational scripts (seeding, backfill, diagnostics)
  deploy/         - Docker Compose, Dockerfiles, VPS setup
```

## Tracked Accounts (Phase 1)

40 accounts across categories:
- **Trump family** - @realDonaldTrump, @DonaldJTrumpJr, @EricTrump, @LaraLeaTrump, @MELANIATRUMP
- **White House / Cabinet** - @POTUS, @VP, @PressSec, @SecBonnell, @KashPatel, @TulsiGabbard
- **Federal agencies** - @ABORNEAUS, @SecretService, @DHSgov
- **Crypto/financial** - @worldlibertyfi, @TRUMPonSOL, @elikiml
- **Key political figures** - @SpeakerJohnson, @SenSchumer, @LeaderJohnThune

Full list in [docs/SEED_ACCOUNTS.md](docs/SEED_ACCOUNTS.md).

## Development

```bash
# Install dependencies
npm install

# Run locally (web + worker)
npm run dev

# Typecheck
npm run typecheck

# Run tests
npm run test

# Generate Drizzle migration
npm run db:generate

# Run migrations
npm run db:migrate
```

### Local services

```bash
docker run --name taa-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tweet_accountability -p 5432:5432 -d postgres:16
docker run --name taa-redis -p 6379:6379 -d redis:7-alpine
```

### Environment variables

Copy `.env.example` and fill in values. Required: `DATABASE_URL`, `REDIS_URL`, `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY`.

See `.env.example` for the full list.

## License

All rights reserved.
