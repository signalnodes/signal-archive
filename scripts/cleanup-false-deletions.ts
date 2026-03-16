/**
 * Cleanup script for false-positive deletion detections caused by the broken
 * oEmbed URL format (/i/web/status/{id} instead of /{username}/status/{id}).
 *
 * What it does:
 *   1. Resets tweets.isDeleted → false, clears deletedAt / deletionDetectedAt
 *   2. Deletes corresponding deletion_events rows
 *   3. Deletes corresponding hcs_attestations of type 'deletion_detected'
 *      (HCS mainnet entries are permanent; this just removes them from the UI)
 *
 * Usage:
 *   # Dry run — shows counts, makes no changes
 *   npx tsx --env-file=.env scripts/cleanup-false-deletions.ts
 *
 *   # Live run
 *   npx tsx --env-file=.env scripts/cleanup-false-deletions.ts --apply
 */

import { getDb, tweets, deletionEvents, hcsAttestations } from "@taa/db";
import { eq, isNotNull } from "drizzle-orm";

const apply = process.argv.includes("--apply");

async function main() {
  const db = getDb();

  // Find all tweets currently marked as deleted
  const deletedTweets = await db
    .select({ id: tweets.id, tweetId: tweets.tweetId, deletionDetectedAt: tweets.deletionDetectedAt })
    .from(tweets)
    .where(eq(tweets.isDeleted, true));

  if (deletedTweets.length === 0) {
    console.log("No deleted tweets found in DB — nothing to clean up.");
    return;
  }

  const ids = deletedTweets.map((t) => t.id);

  // Count deletion_events to be removed
  const deletionEventRows = await db
    .select({ id: deletionEvents.id })
    .from(deletionEvents)
    .where(isNotNull(deletionEvents.tweetId));

  // Count hcs_attestations of type deletion_detected
  const hcsRows = await db
    .select({ id: hcsAttestations.id })
    .from(hcsAttestations)
    .where(eq(hcsAttestations.messageType, "deletion_detected"));

  console.log(`\nScope of cleanup:`);
  console.log(`  Tweets to un-delete:       ${deletedTweets.length}`);
  console.log(`  deletion_events to remove: ${deletionEventRows.length}`);
  console.log(`  hcs_attestations (deletion_detected) to remove: ${hcsRows.length}`);
  console.log(`  Note: HCS mainnet entries (seq ~4739–${4739 + hcsRows.length - 1}) are permanent on-ledger.`);

  if (!apply) {
    console.log(`\nDRY RUN — no changes made. Re-run with --apply to execute.\n`);
    return;
  }

  console.log(`\nApplying cleanup...`);

  // 1. Remove deletion_events (FK references tweets, so delete first)
  await db.delete(deletionEvents);
  console.log(`  Deleted ${deletionEventRows.length} deletion_events`);

  // 2. Remove deletion_detected hcs_attestations
  await db
    .delete(hcsAttestations)
    .where(eq(hcsAttestations.messageType, "deletion_detected"));
  console.log(`  Deleted ${hcsRows.length} hcs_attestations (deletion_detected)`);

  // 3. Reset tweets — do in a single bulk update
  await db
    .update(tweets)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletionDetectedAt: null,
    })
    .where(eq(tweets.isDeleted, true));
  console.log(`  Reset ${deletedTweets.length} tweets to isDeleted=false`);

  console.log(`\nDone. Deploy the fixed oEmbed code and restore HEDERA_TOPIC_ID to re-enable detection.\n`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
