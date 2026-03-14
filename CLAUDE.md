# TAA — Signal Archive

## Docs
- `docs/ARCHITECTURE.md` — full system design, database schema, flows
- `docs/REFERENCE.md` — tech stack, monorepo structure, DB tables, API routes, worker jobs
- `docs/SEED_ACCOUNTS.md` — Phase 1 tracked accounts (~40)

## Dev commands
```bash
npm run dev          # turbo dev (web + worker)
npm run build        # turbo build all
npm run typecheck    # turbo typecheck all
npm run test         # vitest suites (shared + web)
npm run db:generate  # generate Drizzle migration from schema changes
npm run db:migrate   # run Drizzle migrations
npx tsx --env-file=.env scripts/<name>.ts  # run any operational script
```

## Local services
```bash
docker run --name taa-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tweet_accountability -p 5432:5432 -d postgres:16
docker run --name taa-redis -p 6379:6379 -d redis:7-alpine
```

## Env vars (see .env.example)
Required: `DATABASE_URL`, `REDIS_URL`, `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY`, `SOCIALDATA_API_KEY`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
Set `HEDERA_NETWORK=testnet` locally (mainnet in prod)

## Constraints
- Worker builds with `tsup` (CJS bundle), not `tsc` — do not change the build tooling
- Schema changes go through Drizzle only (`db:generate` → `db:migrate`) — never raw SQL
- Run `npm run typecheck` after every code change
- Test Hedera/donation flows on testnet before pushing to mainnet
