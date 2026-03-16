/**
 * Ingest watchdog — alerts via Windows toast + ntfy.sh if ingestion has gone stale.
 *
 * Checks the most recent capturedAt timestamp across all tweets.
 * If no tweet has been captured within the threshold, fires a notification.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/ingest-watchdog.ts
 *
 * Cron (every 30 min):
 *   * /30 * * * * cd ~/Projects/scratch/signal-archive && npx tsx --env-file=.env scripts/ingest-watchdog.ts >> ~/ingest-watchdog.log 2>&1
 *
 * ntfy.sh: set NTFY_TOPIC in .env (e.g. NTFY_TOPIC=signal-archive-abc123)
 * Subscribe at https://ntfy.sh/<your-topic> or the ntfy mobile app.
 */

import { getDb, tweets } from "@taa/db";
import { desc } from "drizzle-orm";
import { execSync } from "node:child_process";

const STALE_THRESHOLD_HOURS = 2;

async function notifyNtfy(title: string, message: string) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return;
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: "POST",
      headers: {
        Title: title,
        Priority: "high",
        Tags: "warning",
      },
      body: message,
    });
  } catch {
    console.warn("[watchdog] ntfy.sh notification failed");
  }
}

function toastWindows(title: string, message: string) {
  const script = `
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
    $template = '<toast><visual><binding template="ToastText02"><text id="1">${title.replace(/'/g, "''")}</text><text id="2">${message.replace(/'/g, "''")}</text></binding></visual></toast>'
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml($template)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Signal Archive").Show($toast)
  `.trim();

  try {
    execSync(`powershell.exe -Command "${script.replace(/\n/g, " ")}"`, { stdio: "ignore" });
  } catch {
    // Toast failed (e.g. not on WSL2) — log only
    console.warn("[watchdog] Could not send Windows toast notification");
  }
}

async function main() {
  const db = getDb();

  const [latest] = await db
    .select({ capturedAt: tweets.capturedAt })
    .from(tweets)
    .orderBy(desc(tweets.capturedAt))
    .limit(1);

  const now = new Date();

  if (!latest?.capturedAt) {
    console.log(`[watchdog] ${now.toISOString()} — no tweets in DB at all`);
    toastWindows("Signal Archive — No Data", "No tweets have ever been captured.");
    await notifyNtfy("Signal Archive — No Data", "No tweets have ever been captured.");
    return;
  }

  const gapMs = now.getTime() - new Date(latest.capturedAt).getTime();
  const gapHours = gapMs / 3_600_000;
  const gapStr = gapHours < 1
    ? `${Math.round(gapMs / 60_000)}m`
    : `${gapHours.toFixed(1)}h`;

  if (gapHours > STALE_THRESHOLD_HOURS) {
    const msg = `Last capture was ${gapStr} ago. Chrome CDP may be down.`;
    console.warn(`[watchdog] ${now.toISOString()} — STALE: ${msg}`);
    toastWindows("Signal Archive — Ingestion Stale", msg);
    await notifyNtfy("Signal Archive — Ingestion Stale", msg);
  } else {
    console.log(`[watchdog] ${now.toISOString()} — OK (last capture ${gapStr} ago)`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
