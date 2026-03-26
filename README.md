# Signal Archive

Cryptographic proof of public statements on Hedera.

**[signalarchive.org](https://signalarchive.org)** · [HashScan topic](https://hashscan.io/mainnet/topic/0.0.10301350)

---
<p align="center">
<img width="687" height="636" alt="image" src="https://github.com/user-attachments/assets/8aa87518-6b61-4ea4-865f-4196b4ec1a96" alt="Proof detail view showing deletion metadata, severity scoring, and Hedera HCS attestation." width="687" />
</p>
<p align="center"><em>Proof detail view showing deletion metadata, severity scoring, and Hedera HCS attestation.</em></p>

## What it does

- Monitors 40 tracked public accounts on X/Twitter continuously
- Archives every tweet to PostgreSQL with a deterministic SHA-256 hash
- Submits each hash to a public Hedera HCS topic — timestamped, permanent, independent of this service
- Detects deletions via oEmbed polling and submits a second on-chain attestation
- Scores each deletion for public interest significance using Claude Opus
- Serves proof via a public web interface; every attestation links directly to HashScan

## Why it matters

Public figures delete statements after they become inconvenient. Screenshots can be fabricated. This system provides a different class of evidence: a cryptographic commitment to the tweet's exact content, submitted to Hedera's public distributed ledger within seconds of posting — before any deletion occurs. The proof exists independently of this service — anyone can verify it directly against Hedera's public network.

## How it works

```
capture → hash → attest → detect deletion → score → display proof
```

1. **Capture** — tier-based ingestion daemon polls accounts. Priority accounts checked hourly, standard accounts every 4 hours.
2. **Hash** — SHA-256 over canonical JSON (content, author ID, timestamp, media URLs). Deterministic and reproducible by anyone with the original data.
3. **Attest** — hash submitted to HCS topic `0.0.10301350` on Hedera mainnet. Consensus in seconds.
4. **Detect** — deletion worker checks archived tweets against X's oEmbed API. 404 → flagged, second HCS attestation submitted.
5. **Score** — Claude Opus rates each deletion 1–10 for public interest significance. Heuristic fallback if API is unavailable.
6. **Verify** — every proof page links to HashScan. No trust required.

## Repo structure

```
signal-archive/
  apps/
    web/        Next.js frontend + API routes
    worker/     BullMQ job consumers (deletion detection, HCS, ingestion)
  packages/
    db/         Drizzle schema + migrations
    shared/     Types, canonical hash, constants
  scripts/      Operational scripts (seeding, backfill, diagnostics)
  deploy/       Docker Compose, Dockerfiles, VPS setup
```

## Hedera integration

- **HCS `0.0.10301350`** — tweet attestations and deletion records (mainnet)
- **HCS `0.0.10310903`** — donation receipts via HIP-551 atomic batch
- **HCS-2 registry `0.0.10388911`** — machine-readable topic registry at [signalarchive.org/registry](https://signalarchive.org/registry)
- **HIP-551** — atomic batch bundles HCS submission + optional NFT mint into a single atomic transaction
- **HIP-657 dNFT `0.0.10314265`** — supporter badge NFTs with dynamic metadata
- 3,000+ messages live on mainnet as of March 2026

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui |
| Database | PostgreSQL 16 (Neon), Drizzle ORM |
| Queue | BullMQ + Redis |
| Chain | @hashgraph/sdk — HCS, HIP-551, HIP-657, NFT minting |
| AI | Claude Opus — deletion severity scoring |
| Ingestion | Headless Chrome (CDP), tier-based cron |
| Hosting | Railway (web), Hetzner VPS (worker, ingestion, Chrome) |

## Tracked accounts

Phase 1: 40 accounts across the US federal executive, White House / Cabinet, key legislative figures, and affiliated crypto/financial projects. Coverage is explicit and manually curated — only accounts added to the tracked list are monitored.

Full list: [docs/SEED_ACCOUNTS.md](docs/SEED_ACCOUNTS.md)

## Development

```bash
npm install
npm run dev          # web + worker (turbo)
npm run typecheck    # run after every change
npm run test
npm run db:generate  # after schema changes
npm run db:migrate
```

Local services setup, environment variables, and deployment details: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

## Limitations

- Coverage is limited to explicitly tracked accounts — tweets from unmonitored accounts are not archived
- Ingestion relies on X's public API; availability depends on X's access policies
- Tweet media (images, video) is not currently archived — only text content and metadata are preserved
- The system records what existed before deletion; it cannot retroactively capture tweets deleted before monitoring began
- Deletion detection uses oEmbed polling, which has inherent latency — very brief deletions may not be caught

## Hackathon

Submitted to the [Hedera Hello Future: Apex Hackathon 2026](docs/HACKATHON.md), Open Track.

---

**License:** All rights reserved.
