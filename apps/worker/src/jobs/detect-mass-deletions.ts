import { and, count, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@taa/db";
import { deletionEvents, massDeletionEvents } from "@taa/db";
import { MASS_DELETION } from "@taa/shared";

/**
 * After a deletion check cycle, call this for each accountId that had new deletions.
 * Counts deletion_events in the rolling window; if >= threshold and no event already
 * recorded for this window bucket, inserts a mass_deletion_events row.
 */
export async function detectMassDeletion(db: Db, accountId: string): Promise<void> {
  const now = new Date();
  const windowMs = MASS_DELETION.WINDOW_HOURS * 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() - windowMs);

  // Count deletions for this account within the window
  const [{ value: deletionCount }] = await db
    .select({ value: count() })
    .from(deletionEvents)
    .where(
      and(
        eq(deletionEvents.accountId, accountId),
        gte(deletionEvents.detectedAt, windowStart)
      )
    );

  if (deletionCount < MASS_DELETION.THRESHOLD) return;

  // Floor windowStart to the hour to produce a stable bucket key for deduplication
  const bucketStart = new Date(windowStart);
  bucketStart.setMinutes(0, 0, 0);

  // Upsert — unique constraint on (accountId, windowStart) will no-op on conflict
  await db
    .insert(massDeletionEvents)
    .values({
      accountId,
      windowStart: bucketStart,
      windowEnd: now,
      deletionCount,
    })
    .onConflictDoUpdate({
      target: [massDeletionEvents.accountId, massDeletionEvents.windowStart],
      set: {
        windowEnd: now,
        deletionCount,
      },
    });

  console.log(
    `[mass-deletion] account=${accountId} flagged: ${deletionCount} deletions in ${MASS_DELETION.WINDOW_HOURS}h window`
  );
}
