/**
 * Pulls profile image URLs from rawJson already stored in the tweets table
 * and writes them to tracked_accounts.avatar_url. No API calls needed.
 *
 * Run: npx tsx --env-file=.env scripts/backfill-avatars.ts
 */

import { getDb, trackedAccounts, tweets } from "@taa/db";
import { eq, isNotNull } from "drizzle-orm";

function hqAvatarUrl(url: string): string {
  return url.replace(/_normal(\.\w+)$/, "_400x400$1");
}

async function main() {
  const db = getDb();

  const accounts = await db
    .select({ id: trackedAccounts.id, twitterId: trackedAccounts.twitterId, username: trackedAccounts.username })
    .from(trackedAccounts);

  console.log(`Processing ${accounts.length} accounts…`);

  let updated = 0;
  let skipped = 0;

  for (const account of accounts) {
    // Grab one tweet's rawJson for this account — any tweet will do
    const [row] = await db
      .select({ rawJson: tweets.rawJson })
      .from(tweets)
      .where(eq(tweets.accountId, account.id))
      .limit(1);

    if (!row?.rawJson) {
      console.log(`  ${account.username}: no tweets stored, skipping`);
      skipped++;
      continue;
    }

    const raw = row.rawJson as Record<string, unknown>;
    const user = raw.user as Record<string, unknown> | undefined;
    const imgUrl = user?.profile_image_url_https as string | undefined;

    if (!imgUrl) {
      console.log(`  ${account.username}: no profile_image_url_https in rawJson`);
      skipped++;
      continue;
    }

    const finalUrl = hqAvatarUrl(imgUrl);
    await db
      .update(trackedAccounts)
      .set({ avatarUrl: finalUrl })
      .where(eq(trackedAccounts.id, account.id));

    console.log(`  ✓ ${account.username}: ${finalUrl}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
