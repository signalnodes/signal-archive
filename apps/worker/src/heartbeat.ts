const HEARTBEAT_URL = process.env.HEARTBEAT_URL;
const INTERVAL_MS = 60 * 1000; // ping every 60s

let timer: ReturnType<typeof setInterval> | null = null;

async function ping() {
  if (!HEARTBEAT_URL) return;
  try {
    await fetch(HEARTBEAT_URL, { signal: AbortSignal.timeout(5000) });
  } catch (err) {
    console.error("[heartbeat] ping failed:", (err as Error).message);
  }
}

export function startHeartbeat() {
  if (!HEARTBEAT_URL) {
    console.log("[heartbeat] HEARTBEAT_URL not set — skipping");
    return;
  }
  // ping immediately on start, then on interval
  void ping();
  timer = setInterval(() => void ping(), INTERVAL_MS);
  console.log(`[heartbeat] started (every ${INTERVAL_MS / 1000}s)`);
}

export function stopHeartbeat() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
