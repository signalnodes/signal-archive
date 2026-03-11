# TAA — Signal Archive

Public accountability platform: monitors, records, and cryptographically attests tweets from public figures. Proof anchored to Hedera Consensus Service (HCS). Live at **signalarchive.org**.

## Docs
- `docs/ARCHITECTURE.md` — full system design, database schema, flows
- `docs/SEED_ACCOUNTS.md` — Phase 1 tracked accounts (~40)

## Tech stack
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui
- **Backend**: TypeScript, Node.js
- **Database**: PostgreSQL 16 (Neon in prod, Docker locally), Drizzle ORM
- **Job queue**: BullMQ + Redis (Railway-managed in prod, Docker locally)
- **Blockchain**: Hedera Consensus Service + NFT badges (@hashgraph/sdk)
- **Tweet ingestion**: SocialData.tools API (primary), browser CDP scraping (legacy fallback)

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
- `deletion_events` — when a tweet deletion was detected
- `hcs_attestations` — Hedera transaction proofs for tweets
- `engagement_snapshots` — periodic retweet/reply/like snapshots
- `supporters` — donor wallets, cumulative USD, badge serial
- `donations` — individual donation transactions (HBAR/USDC amounts, batch_id)
- `tracking_requests` — community nomination requests
- `tracked_wallets` — donor wallet whitelist for research section

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
- `ingest.ts` — archive tweets from tracked accounts via SocialData API
- `check-deletions.ts` — detect deleted tweets
- `submit-hcs.ts` — post attestations to Hedera
- `archive-media.ts` — media archival (stub, not yet implemented)

## Dev commands
```bash
npm run dev                    # turbo dev (web + worker)
npm run build                  # turbo build all
npm run typecheck              # turbo typecheck all
npm run db:migrate             # run Drizzle migrations
npm run db:generate            # generate Drizzle migration from schema changes
npx tsx --env-file=.env scripts/<name>.ts  # run any operational script
```

## Local services
```bash
docker run --name taa-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tweet_accountability -p 5432:5432 -d postgres:16
docker run --name taa-redis -p 6379:6379 -d redis:7-alpine
```

## Env vars (see .env.example)
- DATABASE_URL, REDIS_URL, HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY
- HEDERA_NETWORK (testnet locally, mainnet in prod)
- SOCIALDATA_API_KEY, NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

## Quality gates
- Always run `npm run typecheck` after code changes
- Never skip pre-commit hooks
- Test donation/HCS flows on testnet before mainnet
