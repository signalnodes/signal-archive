/**
 * One-off full backfill for @PressSec (Karoline Leavitt).
 *
 * Wraps browser-ingest.ts with a process lock so it won't run
 * concurrently with a scheduled cron browser-ingest job.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-presssec.ts
 *   npx tsx --env-file=.env scripts/backfill-presssec.ts --cdp
 *   npx tsx --env-file=.env scripts/backfill-presssec.ts --dry-run
 *   npx tsx --env-file=.env scripts/backfill-presssec.ts --since 2025-01-01
 *
 * Any extra flags are passed through to browser-ingest.ts.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const LOCK_FILE = "/tmp/signal-browser-ingest.lock";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Conflict guard ──────────────────────────────────────────────────────────
// Prevent running alongside a cron browser-ingest job. The cron script writes
// this same lock file, so both directions are protected.
if (fs.existsSync(LOCK_FILE)) {
  const existing = fs.readFileSync(LOCK_FILE, "utf8").trim();
  console.error(
    `[backfill-presssec] Lock held by PID ${existing} — ` +
    `a browser-ingest job is already running.\n` +
    `  Wait for it to finish, or remove ${LOCK_FILE} if it's stale.`
  );
  process.exit(1);
}

fs.writeFileSync(LOCK_FILE, String(process.pid));

function releaseLock() {
  try { fs.rmSync(LOCK_FILE, { force: true }); } catch { /* best-effort */ }
}
process.on("exit", releaseLock);
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

// ── Run browser-ingest for @PressSec ───────────────────────────────────────
const extraArgs = process.argv.slice(2); // pass-through: --cdp, --dry-run, --no-hcs, --since, etc.

const child = spawn(
  "npx",
  [
    "tsx",
    path.join(__dirname, "browser-ingest.ts"),
    "--username", "PressSec",
    ...extraArgs,
  ],
  { stdio: "inherit", env: process.env }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
