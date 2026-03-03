import { getDb, trackedAccounts, tweets } from '@taa/db';
import { eq, count } from 'drizzle-orm';

async function main() {
  const db = getDb();
  const accounts = await db.select().from(trackedAccounts);

  console.log('\nAccounts with 0 tweets:\n');
  const zeros: string[] = [];
  for (const a of accounts) {
    const [row] = await db.select({ n: count() }).from(tweets).where(eq(tweets.accountId, a.id));
    const n = Number(row?.n ?? 0);
    if (n === 0) {
      zeros.push(a.username);
      console.log('  @' + a.username.padEnd(28) + ' twitterId=' + a.twitterId + '  tier=' + a.trackingTier);
    }
  }
  console.log('\nTotal: ' + zeros.length + ' of ' + accounts.length + ' accounts have 0 tweets');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
