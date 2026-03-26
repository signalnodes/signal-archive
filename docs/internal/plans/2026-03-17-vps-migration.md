# VPS Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan.

**Goal:** Move all background processing (Redis, BullMQ worker, browser ingestion) from Railway + laptop to VPS, leaving only the Next.js web service on Railway.

**Architecture:** Docker Compose on VPS runs four containers: `redis`, `worker` (existing tsup bundle), `chrome` (headless Google Chrome, CDP on :9222), and `ingest` (node-cron daemon calling browser-ingest.ts --cdp). Scraping traffic routes through a SOCKS5 proxy on the home node via Tailscale, giving all Chrome connections a residential egress IP while worker/DB/API traffic goes direct from VPS.

**Tech Stack:** Node.js 20, TypeScript, Docker Compose, Google Chrome (headless=new), Playwright (CDP mode), BullMQ, ioredis, node-cron, microsocks (home node)

---

## Prerequisites (confirm before starting)

- [ ] VPS accessible via Tailscale (`ssh user@vps-tailscale-ip` works)
- [ ] Docker installed on VPS (`docker --version`)
- [ ] Home machine is online and Tailscale-connected
- [ ] Railway worker is currently the only active BullMQ consumer (confirm via Railway dashboard)
- [ ] `accounts-priority.txt` and `accounts-standard.txt` exist in repo root (run `npx tsx --env-file=.env scripts/gen-accounts-list.ts` if not)

---

## Task 1: Add node-cron dependency

**Files:**
- Modify: `package.json` (root)

**Step 1: Install**
```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

**Step 2: Verify**
```bash
node -e "require('node-cron'); console.log('ok')"
```
Expected: `ok`

**Step 3: Commit**
```bash
git add package.json package-lock.json
git commit -m "deps: add node-cron for VPS ingest daemon"
```

---

## Task 2: Create ingest-daemon.ts

**Files:**
- Create: `scripts/ingest-daemon.ts`

**Step 1: Create the file**

The daemon schedules `browser-ingest.ts` using node-cron. It runs as a long-lived process inside the ingest Docker container.

```typescript
/**
 * Ingest daemon — runs browser-ingest.ts on a cron schedule on VPS.
 *
 * Priority accounts: every 1 hour
 * Standard accounts: every 4 hours (first run offset by 30 min to stagger)
 *
 * Requires:
 *   CDP_URL env var pointing to the chrome container (e.g. http://chrome:9222)
 *   accounts-priority.txt and accounts-standard.txt in the working directory
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/ingest-daemon.ts
 */

import cron from "node-cron";
import { spawn } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts/browser-ingest.ts");
const PRIORITY_LIST = path.join(ROOT, "accounts-priority.txt");
const STANDARD_LIST = path.join(ROOT, "accounts-standard.txt");
const ENV_FILE = path.join(ROOT, ".env");

let isRunningPriority = false;
let isRunningStandard = false;

function runIngest(listFile: string, label: string): Promise<void> {
  return new Promise((resolve) => {
    if (!fs.existsSync(listFile)) {
      console.error(`[daemon] ${label}: list file not found: ${listFile}`);
      resolve();
      return;
    }

    console.log(`[daemon] ${new Date().toISOString()} — starting ${label}`);

    const args = [
      "tsx",
      `--env-file=${ENV_FILE}`,
      SCRIPT,
      "--list", listFile,
      "--cdp",
      "--skip-vpn-check",
    ];

    const child = spawn("npx", args, {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });

    child.on("close", (code) => {
      console.log(`[daemon] ${new Date().toISOString()} — ${label} exited with code ${code}`);
      resolve();
    });

    child.on("error", (err) => {
      console.error(`[daemon] ${label} error:`, err);
      resolve();
    });
  });
}

// Priority accounts: every hour at :00
cron.schedule("0 * * * *", async () => {
  if (isRunningPriority) {
    console.warn("[daemon] priority run still in progress — skipping cycle");
    return;
  }
  isRunningPriority = true;
  try {
    await runIngest(PRIORITY_LIST, "priority");
  } finally {
    isRunningPriority = false;
  }
});

// Standard accounts: every 4 hours at :30 (offset to avoid overlap with priority)
cron.schedule("30 */4 * * *", async () => {
  if (isRunningStandard) {
    console.warn("[daemon] standard run still in progress — skipping cycle");
    return;
  }
  isRunningStandard = true;
  try {
    await runIngest(STANDARD_LIST, "standard");
  } finally {
    isRunningStandard = false;
  }
});

console.log(`[daemon] started — priority: every 1h at :00, standard: every 4h at :30`);
console.log(`[daemon] CDP_URL=${process.env.CDP_URL ?? "http://localhost:9222"}`);

// Keep process alive
process.on("SIGTERM", () => { console.log("[daemon] SIGTERM received — shutting down"); process.exit(0); });
process.on("SIGINT",  () => { console.log("[daemon] SIGINT received — shutting down"); process.exit(0); });
```

**Step 2: Verify syntax**
```bash
npx tsx --no-run scripts/ingest-daemon.ts 2>&1 || npx tsc --noEmit scripts/ingest-daemon.ts 2>&1
```
Expected: no errors (or use typecheck)
```bash
npm run typecheck
```

**Step 3: Commit**
```bash
git add scripts/ingest-daemon.ts
git commit -m "feat(scripts): add ingest-daemon for VPS cron scheduling"
```

---

## Task 3: Create Dockerfile.worker

**Files:**
- Create: `deploy/Dockerfile.worker`

**Step 1: Create**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json turbo.json ./
COPY apps/worker/package*.json ./apps/worker/
COPY apps/web/package*.json ./apps/web/
COPY packages/ ./packages/
RUN npm ci
COPY . .
RUN npx turbo build --filter=@taa/worker

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
CMD ["node", "apps/worker/dist/index.js"]
```

**Step 2: Test build locally**
```bash
docker build -f deploy/Dockerfile.worker -t taa-worker .
```
Expected: build succeeds, image created

**Step 3: Commit**
```bash
git add deploy/Dockerfile.worker
git commit -m "deploy: add Dockerfile.worker for VPS"
```

---

## Task 4: Create Dockerfile.ingest

**Files:**
- Create: `deploy/Dockerfile.ingest`

The ingest container runs the `ingest-daemon.ts` cron. It needs the full source (tsx runs TypeScript directly) and Google Chrome installed for CDP mode.

```dockerfile
FROM node:20-bookworm-slim
WORKDIR /app

# Install Google Chrome (not Chromium — real Chrome for better fingerprint)
RUN apt-get update && apt-get install -y wget gnupg && \
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /usr/share/keyrings/google-chrome.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

# Install Playwright browsers (needed for connectOverCDP)
COPY package*.json ./
RUN npm ci
RUN npx playwright install chromium

COPY . .

CMD ["npx", "tsx", "--env-file=.env", "scripts/ingest-daemon.ts"]
```

**Note:** The `ingest` container runs the ingest-daemon, which calls browser-ingest.ts. The Chrome container is separate. The ingest container does NOT launch Chrome — it connects to the chrome container via `CDP_URL=http://chrome:9222`.

**Step 2: Verify Dockerfile parses**
```bash
docker build --dry-run -f deploy/Dockerfile.ingest . 2>&1 | head -5
```
If `--dry-run` unsupported, just review for syntax errors.

**Step 3: Commit**
```bash
git add deploy/Dockerfile.ingest
git commit -m "deploy: add Dockerfile.ingest for VPS browser ingestion"
```

---

## Task 5: Create docker-compose.yml

**Files:**
- Create: `deploy/docker-compose.yml`

> **IMPORTANT:** Before using this file on VPS, replace `HOME_TAILSCALE_IP` with the actual Tailscale IP of the home node.

```yaml
version: "3.9"

services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --appendfsync everysec
    volumes:
      - redis-data:/data
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  chrome:
    image: node:20-bookworm-slim
    restart: on-failure
    # Uses the same image as ingest; chrome binary is installed via Dockerfile.ingest
    # On VPS: build the ingest image and use it here too, or use a dedicated chrome image
    build:
      context: ..
      dockerfile: deploy/Dockerfile.ingest
    command: >
      google-chrome-stable
      --headless=new
      --no-sandbox
      --disable-gpu
      --disable-dev-shm-usage
      --remote-debugging-port=9222
      --remote-debugging-address=0.0.0.0
      --user-data-dir=/data/chrome-profile
      --disable-blink-features=AutomationControlled
      --proxy-server=socks5://HOME_TAILSCALE_IP:1080
    volumes:
      - chrome-data:/data
    expose:
      - "9222"
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  worker:
    build:
      context: ..
      dockerfile: deploy/Dockerfile.worker
    restart: unless-stopped
    env_file: ../.env
    depends_on:
      - redis
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  ingest:
    build:
      context: ..
      dockerfile: deploy/Dockerfile.ingest
    restart: on-failure
    env_file: ../.env
    depends_on:
      - chrome
      - redis
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  redis-data:
  chrome-data:
```

**Step 2: Commit**
```bash
git add deploy/docker-compose.yml
git commit -m "deploy: add docker-compose.yml for VPS stack"
```

---

## Task 6: Update .env.example

**Files:**
- Modify: `.env.example`

**Step 1: Add new vars**

Add the following section to `.env.example`:

```bash
# ── VPS / Docker ─────────────────────────────────────────────────────────────
CDP_URL=http://chrome:9222          # Chrome CDP endpoint (set to http://localhost:9222 for local --cdp mode)
NTFY_TOPIC=                        # ntfy.sh topic for ingest-watchdog alerts (optional)
HEARTBEAT_URL=                     # Better Stack heartbeat URL (set in Railway worker env OR VPS .env)
```

**Step 2: Verify**
```bash
grep -c "CDP_URL" .env.example
```
Expected: `1`

**Step 3: Commit**
```bash
git add .env.example
git commit -m "chore: add VPS env vars to .env.example"
```

---

## Task 7: Home node — install SOCKS5 proxy (microsocks)

**Target machine:** Home node (already Tailscale-joined)
**Not a code change — infrastructure setup.**

**Step 1: Install microsocks**

On home node (Linux/WSL2 host or a always-on Linux machine):
```bash
# Option A — build from source (small, no deps)
git clone https://github.com/rofl0r/microsocks.git /tmp/microsocks
cd /tmp/microsocks && make
sudo cp microsocks /usr/local/bin/microsocks

# Option B — if on a distro with it packaged
sudo apt install microsocks  # Debian/Ubuntu
```

**Step 2: Find Tailscale IP of home node**
```bash
tailscale ip -4
```
Note this IP — it goes into `docker-compose.yml` as `HOME_TAILSCALE_IP`.

**Step 3: Find the Tailscale interface name**
```bash
ip link show | grep tailscale
# Usually: tailscale0
```

**Step 4: Start microsocks bound to Tailscale interface**
```bash
microsocks -i <tailscale-interface-ip> -p 1080
```
Run in background or daemonize:
```bash
nohup microsocks -i <tailscale-ip> -p 1080 >> ~/microsocks.log 2>&1 &
```

**Step 5: (Optional) systemd service for persistence**
```ini
# /etc/systemd/system/microsocks.service
[Unit]
Description=SOCKS5 proxy for Signal Archive VPS egress
After=network.target

[Service]
ExecStart=/usr/local/bin/microsocks -i <tailscale-ip> -p 1080
Restart=always

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable --now microsocks
```

**Step 6: Verify from VPS (via Tailscale)**
```bash
ssh user@vps-tailscale-ip
curl --socks5 home-tailscale-ip:1080 https://api.ipify.org
```
Expected: returns home node's residential IP (not VPS datacenter IP)

---

## Task 8: VPS — repo clone + .env setup

**Target machine:** VPS
**Not a code change — infrastructure setup.**

**Step 1: Create deploy directory**
```bash
ssh user@vps-tailscale-ip
sudo mkdir -p /opt/signal-archive
sudo chown $USER:$USER /opt/signal-archive
```

**Step 2: Clone repo**
```bash
cd /opt/signal-archive
git clone git@github.com:signalnodes/signal-archive.git .
```
If SSH key not on VPS, add it or use HTTPS with token.

**Step 3: Create .env**
```bash
cp .env.example .env
chmod 600 .env
nano .env   # fill in all values
```

Key values to set:
```
DATABASE_URL=<neon-direct-url>          # same as Railway worker's DATABASE_URL
REDIS_URL=redis://redis:6379            # points to redis container
CDP_URL=http://chrome:9222              # points to chrome container
HEDERA_OPERATOR_ID=...
HEDERA_OPERATOR_KEY=...
HEDERA_NETWORK=mainnet
ANTHROPIC_API_KEY=...
HEARTBEAT_URL=...
NTFY_TOPIC=...                          # optional
# Do NOT set SOCIALDATA_API_KEY — oEmbed fallback activates
```

**Step 4: Substitute HOME_TAILSCALE_IP in docker-compose.yml**
```bash
sed -i "s/HOME_TAILSCALE_IP/<actual-tailscale-ip>/g" deploy/docker-compose.yml
```

**Step 5: Verify**
```bash
grep "TAILSCALE_IP" deploy/docker-compose.yml
```
Expected: no matches (fully substituted)

---

## Task 9: VPS — one-time Chrome profile login

**This step establishes the X/Twitter session in the Chrome profile on VPS. Required only once.**

**Step 1: Install Xvfb and x11vnc on VPS**
```bash
sudo apt-get install -y xvfb x11vnc
```

**Step 2: Create Chrome profile volume location**
```bash
sudo mkdir -p /var/lib/docker/volumes/signal-archive_chrome-data/_data/chrome-profile
```
(Docker will manage this volume, but we pre-create it for the login step.)

**Step 3: Start virtual display**
```bash
Xvfb :99 -screen 0 1920x1080x24 &
```

**Step 4: Start VNC server on VPS (accessible only over Tailscale)**
```bash
x11vnc -display :99 -rfbport 5900 -nopw -forever &
```

**Step 5: On laptop — SSH tunnel the VNC port**
```bash
ssh -L 5900:localhost:5900 user@vps-tailscale-ip -N &
```

**Step 6: On laptop — open VNC viewer**
Connect any VNC client to `localhost:5900`. (macOS: `open vnc://localhost:5900`. Windows: RealVNC or TightVNC viewer.)

**Step 7: On VPS (via terminal) — launch Chrome in the virtual display**
```bash
DISPLAY=:99 google-chrome \
  --no-sandbox \
  --user-data-dir=/var/lib/docker/volumes/signal-archive_chrome-data/_data/chrome-profile \
  https://x.com
```

**Step 8: Log in via VNC viewer**
Log into X/Twitter through the VNC window. Complete 2FA if prompted. Wait for the home feed to fully load.

**Step 9: Close Chrome gracefully**
```bash
pkill google-chrome
```

**Step 10: Kill VNC and Xvfb**
```bash
pkill x11vnc && pkill Xvfb
```

**Step 11: Verify profile was saved**
```bash
ls /var/lib/docker/volumes/signal-archive_chrome-data/_data/chrome-profile/
```
Expected: directories like `Default/`, `Local State`, etc.

---

## Task 10: VPS — deploy Redis + worker, smoke test

**Step 1: Build images**
```bash
cd /opt/signal-archive
docker compose -f deploy/docker-compose.yml build worker
```

**Step 2: Start Redis + worker only**
```bash
docker compose -f deploy/docker-compose.yml up -d redis worker
```

**Step 3: Verify Redis is up**
```bash
docker compose -f deploy/docker-compose.yml exec redis redis-cli ping
```
Expected: `PONG`

**Step 4: Check worker logs**
```bash
docker compose -f deploy/docker-compose.yml logs -f worker
```
Expected: BullMQ workers started, repeating jobs scheduled, no error stack traces. Wait ~60 seconds to confirm deletion-check jobs are enqueuing.

**Step 5: Verify worker can reach Neon Postgres**
The worker logs will show DB connection on startup. Look for:
- No `ECONNREFUSED` or Drizzle connection errors
- Heartbeat log line if `HEARTBEAT_URL` is set

---

## Task 11: Hard cutover — stop Railway worker

> **This is the point of no return for queue ownership. Do not proceed until Task 10 verification passes.**

**Step 1: In Railway dashboard — go to the worker service**

**Step 2: Scale worker to 0 replicas (or pause the service)**
Railway UI: Service → Settings → "Pause service" or reduce replicas to 0.

**Step 3: Confirm Railway worker is stopped**
Wait 30 seconds. Check Railway logs — no new log lines.

**Step 4: Confirm VPS worker picks up queue**
```bash
docker compose -f deploy/docker-compose.yml logs -f worker
```
Expected: BullMQ jobs processing normally, no duplicate-consumer warnings.

**Step 5: Verify deletion-check job runs on VPS worker**
Wait for the deletion-check job cycle (runs every 15 min). Check logs for:
```
[deletion-check] Checking N tweets across M accounts
```

---

## Task 12: VPS — deploy Chrome + ingest

**Step 1: Build ingest image**
```bash
docker compose -f deploy/docker-compose.yml build chrome ingest
```
Note: both use the same Dockerfile.ingest. Build may take 3-5 min (Chrome download).

**Step 2: Start chrome container**
```bash
docker compose -f deploy/docker-compose.yml up -d chrome
```

**Step 3: Verify CDP endpoint responds**
```bash
docker compose -f deploy/docker-compose.yml exec ingest \
  curl -s http://chrome:9222/json/version | head -c 200
```
Expected: JSON with `Browser: Chrome/...`, `webSocketDebuggerUrl`, etc.

**Step 4: Verify SOCKS5 proxy is working from Chrome**
```bash
docker compose -f deploy/docker-compose.yml exec chrome \
  curl --socks5 HOME_TAILSCALE_IP:1080 https://api.ipify.org
```
Expected: home residential IP (not VPS IP)

**Step 5: Start ingest container**
```bash
docker compose -f deploy/docker-compose.yml up -d ingest
```

**Step 6: Manually trigger a test ingest run**
```bash
docker compose -f deploy/docker-compose.yml exec ingest \
  npx tsx --env-file=.env scripts/browser-ingest.ts \
  --cdp --username PressSec --skip-vpn-check --dry-run
```
Expected: tweets parsed and logged, no DB writes (dry-run), no CDP connection errors.

**Step 7: Run a live single-account ingest**
```bash
docker compose -f deploy/docker-compose.yml exec ingest \
  npx tsx --env-file=.env scripts/browser-ingest.ts \
  --cdp --username PressSec --skip-vpn-check
```
Expected: tweets written to Neon. Verify:
```bash
# From local machine
npx tsx --env-file=.env scripts/check-ingest-gap.ts 2>&1 | head -20
```
Look for PressSec showing recent `capturedAt` timestamp.

---

## Task 13: End-to-end pipeline verification

**Step 1: Check ingest daemon started correctly**
```bash
docker compose -f deploy/docker-compose.yml logs ingest
```
Expected:
```
[daemon] started — priority: every 1h at :00, standard: every 4h at :30
[daemon] CDP_URL=http://chrome:9222
```

**Step 2: Verify HCS attestation queue is processing**
```bash
docker compose -f deploy/docker-compose.yml logs worker | grep hcs
```
Expected: `[hcs-submit]` job processing lines after ingest run.

**Step 3: Check container health summary**
```bash
docker compose -f deploy/docker-compose.yml ps
```
Expected: all 4 containers in `running` state (redis, chrome, worker, ingest).

**Step 4: Check ingest-watchdog (optional manual run)**
```bash
docker compose -f deploy/docker-compose.yml exec ingest \
  npx tsx --env-file=.env scripts/ingest-watchdog.ts
```
Expected: `OK (last capture Xm ago)` — not STALE.

---

## Task 14: Observability setup

**Step 1: Set HEARTBEAT_URL in VPS .env**
The worker's heartbeat service pings this URL every 60s. Set up a monitor in Better Stack (or similar) and paste the heartbeat URL:
```bash
echo "HEARTBEAT_URL=https://uptime.betterstack.com/api/v1/heartbeat/..." >> /opt/signal-archive/.env
```
Restart worker to pick up the new env var:
```bash
docker compose -f deploy/docker-compose.yml restart worker
```

**Step 2: Verify heartbeat is pinging**
```bash
docker compose -f deploy/docker-compose.yml logs worker | grep heartbeat
```
Expected: `[heartbeat] ping OK` lines every ~60s.

**Step 3: Set log rotation (already in docker-compose.yml)**
Confirm:
```bash
docker inspect signal-archive-worker-1 | grep -A5 LogConfig
```
Expected: `json-file` driver with `max-size: 10m`.

**Step 4: Commit any final .env.example updates**
```bash
git add .env.example
git diff --cached
git commit -m "chore: finalize VPS env documentation"
```

**Step 5: Push all commits**
```bash
git push origin main
```

---

## Rollback Plan

If VPS worker has issues after Railway worker is stopped:

1. Re-enable Railway worker service (Railway dashboard → unpause)
2. Stop VPS worker: `docker compose -f deploy/docker-compose.yml stop worker`
3. Railway worker resumes consuming the queue (BullMQ state is in VPS Redis at this point — Railway worker needs `REDIS_URL` pointing to VPS Redis, which is not directly accessible from Railway)

> **Note:** Once Railway Redis is replaced by VPS Redis, Railway services cannot talk to VPS Redis (no direct inbound access). The rollback path is: restore Railway Redis by re-deploying Railway worker with its original internal Redis URL and re-adding any lost repeating jobs via `scripts/`. Full rollback is lossy for job state but not for DB state (Neon is unaffected throughout).

---

## Reserved Slots (not in scope this sprint)

- `bonzo-agent` container: Hedera Agent Kit framework, built on VPS after Signal Archive submission. Add as a new service in `deploy/docker-compose.yml`.
- `mcp-server` container: stdio MCP server, reads Neon. Add when MCP work begins.
- Postgres on VPS: add `postgres` service to Compose when Railway/Neon costs become relevant.
