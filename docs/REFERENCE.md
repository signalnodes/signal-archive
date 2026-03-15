# TAA — Quick Reference

Structured lookup tables for agents and humans. See `docs/ARCHITECTURE.md` for design rationale and flows.

## Tech stack
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui
- **Backend**: TypeScript, Node.js
- **Database**: PostgreSQL 16 (Neon in prod, Docker locally), Drizzle ORM
- **Job queue**: BullMQ + Redis (Railway-managed in prod, Docker locally)
- **Blockchain**: Hedera Consensus Service + NFT badges (@hashgraph/sdk)
- **Tweet ingestion**: SocialData.tools API (optional, when `SOCIALDATA_API_KEY` set), Windows Chrome CDP scraping for manual backfill
- **Deletion detection**: SocialData.tools API (primary, when key set) → oEmbed API (free fallback, no key needed)
- **Worker health**: Better Stack heartbeat every 60s (`HEARTBEAT_URL` env var)

## Monorepo structure
```
apps/web        — Next.js frontend + API routes
apps/worker     — BullMQ job consumers
packages/db     — Drizzle schema + migrations
packages/shared — Types, canonical hash, constants
scripts/        — Operational scripts (seeding, HCS topics, badge mgmt)
```

## Database tables (packages/db/src/schema/)
- `tracked_accounts` — accounts to monitor (+ `donor_only` flag)
- `tweets` — archived tweet content + content_hash + is_deleted
- `deletion_events` — when a tweet deletion was detected (severity_score 1-10 via Claude Haiku)
- `mass_deletion_events` — accounts that delete 5+ tweets within 1 hour
- `hcs_attestations` — Hedera transaction proofs for tweets
- `supporters` — donor wallets, cumulative USD, badge serial
- `donations` — individual donation transactions (HBAR/USDC amounts, batch_id)
- `tracked_wallets` — donor wallet whitelist for research section

> `engagement_snapshots` and `tracking_requests` were dropped in migration 0006 — no readers or writers.

## API routes (apps/web/app/api/)
- `POST /api/donations/prepare` — prepare atomic batch (HIP-551)
- `POST /api/donations/execute` — verify transfer + run operator batch + record donation
- `POST /api/donations/verify` — legacy verification
- `GET  /api/supporters/[walletAddress]` — check donor status
- `GET  /api/research/wallets` — donor-gated wallet watch data
- `GET  /api/research/accounts` — donor-gated accounts list
- `GET  /api/nft/[serial]` — badge NFT metadata
- `GET  /api/accounts/[username]/statements` — tweet statements
- `GET  /api/accounts/[username]/activity` — recent activity
- `GET  /api/accounts/[username]/attestations` — HCS proofs
- `GET  /api/accounts/[username]/deletions` — deletion events
- `GET  /api/health` — health check

## Worker jobs (apps/worker/src/jobs/)
- `ingest.ts` — archive tweets via SocialData API (no-op if key not set)
- `check-deletions.ts` — detect deleted tweets via SocialData (primary) or oEmbed (free fallback)
- `submit-hcs.ts` — post attestations to Hedera
- `archive-media.ts` — media archival (stub, not yet implemented)

## Operational scripts (scripts/)
- `check-ingest-gap.ts` — show per-account gap since last capture + print backfill command
- `browser-ingest.ts` — CDP backfill via Windows Chrome; auto-launches Chrome if not running
- `seed-accounts.ts` — bulk load tracked accounts from a list
- `backfill-mainnet-attestations.ts` — retroactively submit HCS attestations for existing tweets
