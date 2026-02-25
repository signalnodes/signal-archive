# Project Workflow (WSL + GitHub)

This repo follows a standard workflow used across my WSL projects. Prefer the canonical commands below and avoid improvising new scaffolding unless I ask.

## Folder conventions (context)
- Projects root: ~/Projects
- scratch/ = experiments + MVPs
- oss/ = open-source candidates
- clients/ = client work
- scripts/ = helper scripts (not part of most repos)

## Canonical creation flow
New Node projects are created from the template at:
- ~/Projects/scratch/_template-node

Preferred generator:
- new-node <project-name> [target-folder]

Examples:
- new-node my-project (defaults to ~/Projects/scratch)
- new-node my-project ~/Projects/oss

Expected result after generation:
- git repo initialized on branch main
- initial commit exists (init from template)
- .env is ignored
- .env.example exists and is committed

## GitHub (preferred: gh CLI, private by default)
Create the GitHub repo with:
- gh repo create <repo-name> --private --source . --remote origin --push

After that (normal workflow):
- git add .
- git commit -m "..."
- git push

## Sync workflow (when GitHub was edited elsewhere)
Inside the repo:
- git fetch origin
- git pull --rebase

## Security rules (non-negotiable)
Never commit secrets.

### Env handling
- .env must NEVER be tracked.
- .env.example SHOULD exist and can be committed.

.gitignore policy:
- ignore .env
- ignore .env.*
- allow !.env.example

Quick checks:
- git check-ignore -v .env || echo ".env is NOT ignored"
- git ls-files | grep -E '^\.env' && echo "BAD: env tracked" || echo "OK: env not tracked"

---

# TAA — Tweet Accountability Archive

## Project context
Read docs/ARCHITECTURE.md for full system design, database schema, tech stack, and implementation patterns.
Read docs/SEED_ACCOUNTS.md for Phase 1 tracked accounts list.

## Tech stack
- **Frontend**: Next.js 14+ (App Router), Tailwind CSS
- **Backend**: TypeScript, Node.js
- **Database**: PostgreSQL 16 (Docker), Drizzle ORM
- **Job queue**: BullMQ + Redis
- **Blockchain**: Hedera Consensus Service (@hashgraph/sdk)
- **Browser automation**: Stagehand or similar (TBD)

## Local services
- Postgres: `docker run --name taa-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=tweet_accountability -p 5432:5432 -d postgres:16`
- Redis: `docker run --name taa-redis -p 6379:6379 -d redis:7-alpine`

## Env vars (see .env.example)
- DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tweet_accountability
- REDIS_URL=redis://localhost:6379
- HEDERA_OPERATOR_ID=
- HEDERA_OPERATOR_KEY=
- HEDERA_NETWORK=testnet

## Monorepo structure
- apps/web — Next.js frontend + API routes
- apps/worker — BullMQ job consumers (ingestion, deletion checks, HCS)
- packages/db — Drizzle schema + migrations
- packages/shared — Types, canonical hash utils, constants