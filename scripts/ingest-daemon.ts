/**
 * Ingest daemon — schedules browser-ingest.ts on VPS via node-cron.
 *
 * Runs as a long-lived process inside the ingest Docker container.
 * Connects to the chrome container via CDP (CDP_URL env var).
 *
 * Schedule:
 *   Priority accounts (accounts-priority.txt) — every 1 hour at :00
 *   Standard accounts (accounts-standard.txt) — every 4 hours at :30
 *   Fallback: if tier files are missing, accounts.txt runs hourly
 *
 * Usage (local debug):
 *   npx tsx --env-file=.env scripts/ingest-daemon.ts
 *
 * Env vars:
 *   CDP_URL   — Chrome CDP endpoint (default: http://localhost:9222)
 *               In Docker: http://chrome:9223 (via chrome-proxy.cjs)
 */

import cron from "node-cron";
import { spawn } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "browser-ingest.ts");
const ENV_FILE = path.join(ROOT, ".env");

// Rolling --since window: use ARCHIVE_SINCE env var, or default to 48h ago.
// Prevents full-timeline scrapes on every cron cycle.
function getSinceDate(): string {
  if (process.env.ARCHIVE_SINCE) return process.env.ARCHIVE_SINCE;
  const d = new Date(Date.now() - 48 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

const PRIORITY_LIST = path.join(ROOT, "accounts-priority.txt");
const STANDARD_LIST = path.join(ROOT, "accounts-standard.txt");
const FALLBACK_LIST = path.join(ROOT, "accounts.txt");

// Determine which list files are available at startup
const hasPriorityList = fs.existsSync(PRIORITY_LIST);
const hasStandardList = fs.existsSync(STANDARD_LIST);
const hasFallbackList = fs.existsSync(FALLBACK_LIST);

if (!hasPriorityList && !hasFallbackList) {
  console.error("[daemon] No account list files found. Expected accounts-priority.txt or accounts.txt in project root.");
  process.exit(1);
}

// Overlap guards — skip a cycle if the previous run is still in progress
let isRunningPriority = false;
let isRunningStandard = false;

function runIngest(listFile: string, label: string): Promise<void> {
  return new Promise((resolve) => {
    if (!fs.existsSync(listFile)) {
      console.warn(`[daemon] ${label}: list file not found at ${listFile} — skipping`);
      resolve();
      return;
    }

    const started = new Date().toISOString();
    console.log(`[daemon] ${started} — starting ${label} (${path.basename(listFile)})`);

    const since = getSinceDate();
    const child = spawn(
      "npx",
      ["tsx", `--env-file=${ENV_FILE}`, SCRIPT, "--list", listFile, "--cdp", "--skip-vpn-check", "--since", since],
      { cwd: ROOT, stdio: "inherit", env: process.env }
    );

    child.on("close", (code) => {
      const elapsed = ((Date.now() - new Date(started).getTime()) / 1000 / 60).toFixed(1);
      const status = code === 0 ? "OK" : `FAILED (exit ${code})`;
      console.log(`[daemon] ${new Date().toISOString()} — ${label} ${status} — ${elapsed}m elapsed`);
      resolve();
    });

    child.on("error", (err) => {
      console.error(`[daemon] ${label} spawn error:`, err.message);
      resolve();
    });
  });
}

// ── Priority schedule: every hour at :00 ──────────────────────────────────────
const priorityList = hasPriorityList ? PRIORITY_LIST : FALLBACK_LIST;
const priorityLabel = hasPriorityList ? "priority" : "all-accounts (fallback)";

cron.schedule("0 * * * *", async () => {
  if (isRunningPriority) {
    console.warn("[daemon] priority run still in progress — skipping this cycle");
    return;
  }
  isRunningPriority = true;
  try {
    await runIngest(priorityList, priorityLabel);
  } finally {
    isRunningPriority = false;
  }
});

// ── Standard schedule: every 4 hours at :30 ───────────────────────────────────
// Offset by 30 min to avoid overlap with priority runs.
// Only scheduled if a dedicated standard list exists.
if (hasStandardList) {
  cron.schedule("30 */4 * * *", async () => {
    if (isRunningStandard) {
      console.warn("[daemon] standard run still in progress — skipping this cycle");
      return;
    }
    isRunningStandard = true;
    try {
      await runIngest(STANDARD_LIST, "standard");
    } finally {
      isRunningStandard = false;
    }
  });
}

// ── Startup summary ────────────────────────────────────────────────────────────
console.log(`[daemon] started at ${new Date().toISOString()}`);
console.log(`[daemon] CDP_URL   : ${process.env.CDP_URL ?? "http://localhost:9222 (default)"}`);
console.log(`[daemon] priority  : ${priorityLabel} @ ${path.basename(priorityList)} — every 1h at :00`);
if (hasStandardList) {
  console.log(`[daemon] standard  : accounts-standard.txt — every 4h at :30`);
} else {
  console.log(`[daemon] standard  : no accounts-standard.txt found — skipped`);
}
console.log(`[daemon] next priority run at next :00 boundary`);

// ── Graceful shutdown ──────────────────────────────────────────────────────────
function shutdown(signal: string) {
  console.log(`[daemon] ${signal} received — shutting down gracefully`);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
