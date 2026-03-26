# VPS Migration Design — Signal Archive
Date: 2026-03-17
Status: Approved

---

## Scope

Migrate all background processing (BullMQ worker, Redis, browser ingestion) from Railway + laptop to VPS (Hetzner, 4GB RAM, 3 vCPU, 80GB, US-West). Railway retains only the Next.js web service. Neon Postgres unchanged.

**Deadline:** March 23, 2026 (Hello Future Hackathon — Apex submission)

### Non-goals (explicitly deferred)
- Postgres migration to VPS
- edgeofsignal.com migration
- Bonzo Agent Kit agent (reserved slot only — built if Signal Archive ships with time to spare before March 23, otherwise post-hackathon)
- Media archival (R2)
- Phase 2 Congress accounts (~535)
- Full Railway wind-down

---

## Current State

| Component | Location | Notes |
|---|---|---|
| Next.js web (signalarchive.org) | Railway | Running |
| BullMQ worker (deletion detection, HCS, scoring) | Railway | Running; Railway Redis internal-only |
| Browser ingestion cron | Laptop (WSL2) | Fragile; blocks on laptop availability |
| Redis | Railway (internal) | `redis.railway.internal` — inaccessible outside Railway |
| Neon Postgres | Neon managed | Pooled URL (web), direct URL (worker/migrations) |
| VPS | Hetzner | Docker + Tailscale installed; nothing deployed |

---

## Target Architecture

```
VPS (Docker Compose)
├── redis          — redis:7-alpine, AOF persistence
├── chrome         — google-chrome-stable, headless, CDP on :9222
├── worker         — @taa/worker tsup bundle
└── ingest         — node cron, browser-ingest.ts --cdp

Railway
└── web            — Next.js, unchanged

External
├── Neon Postgres  — unchanged; worker + web both connect
└── Hedera Mainnet — unchanged; worker submits HCS messages
```

---

## Networking Model

**Selective egress: SOCKS5 proxy on home node, consumed by Chrome container only.**

Setting Tailscale `--exit-node` on VPS routes ALL traffic through home — breaks Neon/Hedera/Claude. Wrong approach.

**Correct mechanism:**
1. Home machine (already Tailscale-joined) runs a SOCKS5 daemon bound to its Tailscale interface. Options:
   - `microsocks` or `gost` as a persistent daemon (preferred)
   - `autossh -D 1080` SSH SOCKS tunnel from VPS as an alternative
2. Chrome container starts with `--proxy-server=socks5://home-tailscale-ip:1080`
3. No other container uses the proxy

**Traffic routing:**
```
Chrome (VPS) ──SOCKS5──► home node (Tailscale) ──residential ISP──► twitter.com
Worker (VPS) ──────────────────────────────────────────────────────► Neon / Hedera / Claude / OpenRouter
```

Twitter sees residential IP. All other services see VPS IP directly.

**Failure mode:** SOCKS5 drop causes Chrome connections to fail; ingest container bails the cycle. Worker continues unaffected.

---

## Browser Execution: Headless Chrome on VPS (Option A)

**Default: headless Chrome on VPS, traffic via residential SOCKS5 proxy.**

CDP interception is network-layer (intercepting `UserTweets` GraphQL XHR), not DOM automation. Primary detection gate is IP reputation — handled by residential proxy. Secondary gate (browser fingerprint) is mitigated by `--headless=new`, persistent user-data-dir (session cookies), and `--disable-blink-features=AutomationControlled`.

**Instant fallback (Option B): Chrome on home machine, VPS orchestrates via remote CDP.**
- Zero code changes — `CDP_URL` is already an env var (line 79, `browser-ingest.ts`)
- Change `CDP_URL=http://home-tailscale-ip:9222` to switch modes
- Requires home machine + Chrome running 24/7

Default to Option A. Switch to Option B if X blocks headless Chrome.

---

## Docker Compose

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --appendfsync everysec
    volumes:
      - redis-data:/data
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

  chrome:
    image: google/chrome  # or zenika/alpine-chrome or custom
    restart: on-failure
    command: >
      google-chrome-stable
      --headless=new
      --no-sandbox
      --disable-gpu
      --remote-debugging-port=9222
      --remote-debugging-address=0.0.0.0
      --user-data-dir=/data/chrome-profile
      --disable-blink-features=AutomationControlled
      --proxy-server=socks5://home-tailscale-ip:1080
    volumes:
      - chrome-data:/data
    expose:
      - "9222"
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

  worker:
    image: node:20-alpine
    restart: unless-stopped
    working_dir: /app
    command: node apps/worker/dist/index.js
    env_file: .env
    depends_on: [redis]
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

  ingest:
    image: node:20-alpine
    restart: on-failure
    working_dir: /app
    # node-cron inside, runs browser-ingest.ts --cdp --list accounts.txt on schedule
    env_file: .env
    depends_on: [chrome, redis]
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

volumes:
  redis-data:
  chrome-data:
```

---

## Environment Variables

New vars required on VPS `.env`:
```
CDP_URL=http://chrome:9222
REDIS_URL=redis://redis:6379
```

Existing vars carried over from Railway (unchanged):
```
DATABASE_URL=<neon-direct-url>
HEDERA_OPERATOR_ID=...
HEDERA_OPERATOR_KEY=...
HEDERA_NETWORK=mainnet
SOCIALDATA_API_KEY=  # leave unset; oEmbed fallback activates
HEARTBEAT_URL=...    # set this — enables Better Stack monitoring
ANTHROPIC_API_KEY=...  # for severity scoring
```

Railway web service: remove `REDIS_URL` if present (web doesn't use Redis).

**Secrets handling:**
- `/opt/signal-archive/.env`, `chmod 600`, owned by deploy user
- `env_file: .env` in Compose — no secrets in Dockerfiles or image layers

---

## Migration Sequence (hard cutover)

| Step | Action | Risk |
|---|---|---|
| 1 | Set up SOCKS5 on home node, verify VPS can reach twitter.com via it | Low |
| 2 | Deploy Redis + worker on VPS, point at Neon + VPS Redis | Low |
| 3 | Smoke test: confirm BullMQ jobs process, deletion checks run | Low |
| 4 | **Hard stop Railway worker** (prevents duplicate queue consumers) | Medium — do this cleanly |
| 5 | Deploy Chrome + ingest containers | Medium |
| 6 | Run first ingest cycle, confirm tweets landing in Neon | Medium |
| 7 | Verify end-to-end: ingest → deletion check → HCS attestation | Low (pipeline unchanged) |
| 8 | Set HEARTBEAT_URL, confirm Better Stack monitoring active | Low |

No dual-running period. Railway worker stops before VPS worker processes its first job.

---

## Restart Policy

| Container | Policy | Reason |
|---|---|---|
| redis | `unless-stopped` | Stateful; must stay up |
| worker | `unless-stopped` | Core processing; auto-recover crashes |
| chrome | `on-failure` | Flaky by nature; don't restart if manually stopped |
| ingest | `on-failure` | Cron process; expected to exit between cycles |

---

## Redis Persistence

AOF with `everysec` fsync: at most 1 second of job state lost on crash. BullMQ repeating jobs auto-reschedule on restart — even total Redis loss recovers within one missed cycle.

---

## Observability

- **Docker logs**: json-file driver, 10MB rotation, 3 files per container. `docker compose logs -f worker` for live tail.
- **Better Stack heartbeat**: already in worker codebase (`apps/worker/services/heartbeat.ts`). Set `HEARTBEAT_URL` env var — fires every 60s automatically.
- No ELK/Loki/Prometheus this sprint.

---

## Agent Scaffold (future)

BullMQ queues are the inter-agent communication layer. Each future agent is a new queue consumer or separate container. Reserved slots:

```
ingest-agent    → [ingestion queue]   → worker (HCS, scoring)
deletion-agent  → [deletion queue]    → worker (deletion events, HCS)
scoring-agent   → fires in worker on deletion detection
bonzo-agent     → [bonzo queue]       → Hedera Agent Kit container  ← reserved, post-SA
mcp-server      → stdio container, reads Neon                       ← reserved
```

---

## Key Risks

| Risk | Mitigation |
|---|---|
| Headless Chrome blocked by X | Switch CDP_URL to home machine (Option B fallback, zero code change) |
| SOCKS5 proxy drops | Ingest bails current cycle; worker unaffected; autossh for resilience |
| Duplicate BullMQ consumers during cutover | Hard-stop Railway worker before VPS worker starts processing |
| Chrome OOM (4GB RAM) | Docker memory limit on chrome container (512MB); on-failure restart |
| VPS goes down | Better Stack heartbeat alerts within 2 minutes |
