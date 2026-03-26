# Development Setup

## Prerequisites

- Node.js 20+
- Docker (for local Postgres and Redis)
- An `.env` file based on `.env.example`

## Local services

```bash
# Postgres
docker run --name taa-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tweet_accountability \
  -p 5432:5432 -d postgres:16

# Redis
docker run --name taa-redis -p 6379:6379 -d redis:7-alpine
```

## Environment variables

Copy `.env.example` and fill in values.

Required:
- `DATABASE_URL` — Postgres connection string
- `REDIS_URL` — Redis connection string
- `HEDERA_OPERATOR_ID` — Hedera account ID
- `HEDERA_OPERATOR_KEY` — Hedera private key
- `SOCIALDATA_API_KEY` — for tweet ingestion
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — for wallet connection

Set `HEDERA_NETWORK=testnet` locally. Production uses mainnet.

## Commands

```bash
npm install
npm run dev          # turbo dev (web + worker)
npm run build        # turbo build all
npm run typecheck    # run after every code change
npm run test         # vitest suites (shared + web)
npm run db:generate  # generate Drizzle migration from schema changes
npm run db:migrate   # apply migrations
```

Run operational scripts:
```bash
npx tsx --env-file=.env scripts/<name>.ts
```

## Worker build note

The worker builds with `tsup` (CJS bundle), not `tsc`. Do not change the build tooling — ESM output breaks the worker's deployment environment.

## Schema changes

All schema changes go through Drizzle only:
1. Edit `packages/db/schema.ts`
2. `npm run db:generate`
3. `npm run db:migrate`

Never apply raw SQL directly.

## Testing Hedera flows

Use `HEDERA_NETWORK=testnet` for all local development involving HCS or NFT operations. Verify on testnet before pushing any mainnet-touching changes.
