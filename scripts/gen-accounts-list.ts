import { getDb, trackedAccounts } from '@taa/db';
import { asc } from 'drizzle-orm';
import * as fs from 'node:fs';

async function main() {
  const db = getDb();
  const accounts = await db
    .select({ username: trackedAccounts.username, tier: trackedAccounts.trackingTier })
    .from(trackedAccounts)
    .orderBy(asc(trackedAccounts.trackingTier), asc(trackedAccounts.username));

  const priority = accounts.filter(a => a.tier === 'priority');
  const standard = accounts.filter(a => a.tier === 'standard');
  const low = accounts.filter(a => a.tier === 'low');

  const priorityLines = [
    '# Signal Archive — priority accounts',
    '# Generated: ' + new Date().toISOString(),
    '',
    ...priority.map(a => a.username),
  ];

  const standardLines = [
    '# Signal Archive — standard + low accounts',
    '# Generated: ' + new Date().toISOString(),
    '',
    ...standard.map(a => a.username),
    '',
    '# --- low ---',
    ...low.map(a => a.username),
  ];

  fs.writeFileSync('accounts-priority.txt', priorityLines.join('\n') + '\n');
  fs.writeFileSync('accounts-standard.txt', standardLines.join('\n') + '\n');

  // Keep combined file for manual full runs
  const allLines = [
    '# Signal Archive — all accounts',
    '# Generated: ' + new Date().toISOString(),
    '',
    '# --- priority ---',
    ...priority.map(a => a.username),
    '',
    '# --- standard ---',
    ...standard.map(a => a.username),
    '',
    '# --- low ---',
    ...low.map(a => a.username),
  ];
  fs.writeFileSync('accounts.txt', allLines.join('\n') + '\n');

  console.log(`Written: ${priority.length} priority → accounts-priority.txt, ${standard.length + low.length} standard/low → accounts-standard.txt, ${accounts.length} total → accounts.txt`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
