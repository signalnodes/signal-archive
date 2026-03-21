/**
 * Backfill AI severity scores for all existing deletion events that have NULL severity.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-severity-scores.ts
 *   npx tsx --env-file=.env scripts/backfill-severity-scores.ts --dry-run
 *   npx tsx --env-file=.env scripts/backfill-severity-scores.ts --heuristic-only
 *
 * Options:
 *   --dry-run           Score but don't write to DB (preview results)
 *   --heuristic-only    Use heuristic scorer only (no LLM calls)
 *   --rescore-heuristic Also rescore rows that were previously heuristic-scored
 *   --limit N           Max deletions to score (default: all)
 *   --delay N           Delay between LLM calls in ms (default: 1000)
 */

import { eq, isNull, desc, sql, or } from "drizzle-orm";
import { getDb, deletionEvents, tweets, trackedAccounts } from "@taa/db";
import type { ScoringContext, ScoringResult } from "@taa/shared";

// --- Parse CLI args ---
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const HEURISTIC_ONLY = args.includes("--heuristic-only");
const RESCORE_HEURISTIC = args.includes("--rescore-heuristic");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 0;
const delayIdx = args.indexOf("--delay");
const DELAY_MS = delayIdx >= 0 ? parseInt(args[delayIdx + 1], 10) : 1000;

// --- Lazy import scorer to avoid requiring API key at module load ---
async function getScorer(): Promise<
  (ctx: ScoringContext) => Promise<ScoringResult>
> {
  if (HEURISTIC_ONLY) {
    // Dynamic import to get the heuristic function
    const mod = await import("../apps/worker/src/services/ai-scorer");
    return (ctx) => Promise.resolve(mod.heuristicScore(ctx));
  }
  const mod = await import("../apps/worker/src/services/ai-scorer");
  return mod.scoreDeletion;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("=== Backfill Severity Scores ===");
  console.log(`Mode: ${HEURISTIC_ONLY ? "heuristic-only" : "AI (with heuristic fallback)"}`);
  console.log(`Target: ${RESCORE_HEURISTIC ? "NULL scores + heuristic-scored rows" : "NULL scores only"}`);
  console.log(`Dry run: ${DRY_RUN}`);
  if (LIMIT > 0) console.log(`Limit: ${LIMIT}`);
  console.log(`Delay between calls: ${DELAY_MS}ms`);
  console.log("");

  const db = getDb();
  const scoreFn = await getScorer();

  // Query all deletion events without a severity score, joined with tweet + account context
  const query = db
    .select({
      deletionId: deletionEvents.id,
      contentPreview: deletionEvents.contentPreview,
      detectedAt: deletionEvents.detectedAt,
      tweetAgeHours: deletionEvents.tweetAgeHours,
      tweetContent: tweets.content,
      tweetType: tweets.tweetType,
      mediaUrls: tweets.mediaUrls,
      postedAt: tweets.postedAt,
      username: trackedAccounts.username,
      displayName: trackedAccounts.displayName,
      category: trackedAccounts.category,
      subcategory: trackedAccounts.subcategory,
    })
    .from(deletionEvents)
    .leftJoin(tweets, eq(deletionEvents.tweetId, tweets.id))
    .leftJoin(trackedAccounts, eq(deletionEvents.accountId, trackedAccounts.id))
    .where(
      RESCORE_HEURISTIC
        ? or(
            isNull(deletionEvents.severityScore),
            sql`${deletionEvents.categoryTags} @> ARRAY['heuristic_scored']::text[]`
          )
        : isNull(deletionEvents.severityScore)
    )
    .orderBy(desc(deletionEvents.detectedAt));

  const rows = LIMIT > 0 ? await query.limit(LIMIT) : await query;

  console.log(`Found ${rows.length} deletions without severity scores.\n`);

  if (rows.length === 0) {
    console.log("Nothing to backfill. Done.");
    process.exit(0);
  }

  let scored = 0;
  let errors = 0;

  for (const row of rows) {
    const content = row.tweetContent ?? row.contentPreview ?? "";
    if (!content) {
      console.log(`  [skip] Deletion ${row.deletionId}: no content available`);
      continue;
    }

    const tweetAgeHours = row.tweetAgeHours
      ? Math.round(parseFloat(row.tweetAgeHours))
      : 0;

    const ctx: ScoringContext = {
      username: row.username ?? "unknown",
      displayName: row.displayName ?? null,
      category: row.category ?? "unknown",
      subcategory: row.subcategory ?? null,
      content,
      postedAt: row.postedAt?.toISOString() ?? new Date().toISOString(),
      tweetAgeHours,
      tweetType: row.tweetType ?? "tweet",
      hasMedia: (row.mediaUrls?.length ?? 0) > 0,
    };

    try {
      const result = await scoreFn(ctx);
      scored++;

      const preview = content.slice(0, 60).replace(/\n/g, " ");
      console.log(
        `  [${scored}/${rows.length}] @${ctx.username}: ${result.severity}/10 ` +
          `(${result.model}, ${result.latencyMs}ms): "${preview}..."`
      );

      if (!DRY_RUN) {
        await db
          .update(deletionEvents)
          .set({
            severityScore: result.severity,
            categoryTags: result.categoryTags,
            metadata: {
              ai: {
                reasoning: result.reasoning,
                confidence: result.confidence,
                model: result.model,
                scoredAt: result.scoredAt,
                latencyMs: result.latencyMs,
                backfilled: true,
              },
            },
          })
          .where(eq(deletionEvents.id, row.deletionId));
      }

      // Throttle LLM calls
      if (!HEURISTIC_ONLY && DELAY_MS > 0) {
        await sleep(DELAY_MS);
      }
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [error] Deletion ${row.deletionId}: ${msg}`);
    }
  }

  console.log("");
  console.log("=== Backfill Complete ===");
  console.log(`Scored: ${scored}/${rows.length}`);
  console.log(`Errors: ${errors}`);
  if (DRY_RUN) console.log("(dry run, no DB writes)");

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
