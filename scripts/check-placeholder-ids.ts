import { getDb, trackedAccounts } from '@taa/db';

async function main() {
  const db = getDb();
  const accounts = await db.select().from(trackedAccounts);
  const bad = accounts.filter(a => {
    const id = a.twitterId ?? '';
    return id === '' || id.startsWith('0');
  });
  console.log(`\nBad/placeholder IDs: ${bad.length} of ${accounts.length} total\n`);
  for (const a of bad) {
    console.log(`  @${a.username.padEnd(28)} id='${a.twitterId}'  active=${a.isActive}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

async function checkTweetCounts() {
  const db = getDb();
  const accounts = await db.select().from(trackedAccounts);
  
  const { tweets } = await import('@taa/db');
  const { eq, count } = await import('drizzle-orm');
  
  console.log('\nTweet counts per account:\n');
  const zeros: string[] = [];
  for (const a of accounts) {
    const [row] = await db.select({ n: count() }).from(tweets).where(eq(tweets.accountId, a.id));
    const n = Number(row?.n ?? 0);
    if (n === 0) zeros.push(a.username);
    if (n === 0) console.log(`  @${a.username.padEnd(28)} 0 tweets`);
  }
  console.log(`\n${zeros.length} accounts with 0 tweets`);
}
