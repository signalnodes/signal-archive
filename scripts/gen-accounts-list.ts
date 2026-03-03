import { getDb, trackedAccounts } from '@taa/db';
import { asc } from 'drizzle-orm';
import * as fs from 'node:fs';

async function main() {
  const db = getDb();
  const accounts = await db
    .select({ username: trackedAccounts.username, tier: trackedAccounts.trackingTier })
    .from(trackedAccounts)
    .orderBy(asc(trackedAccounts.trackingTier), asc(trackedAccounts.username));

  const lines = [
    '# Signal Archive — browser-ingest account list',
    '# Generated: ' + new Date().toISOString(),
    '# priority tier first, then standard, then low',
    '',
    '# --- priority ---',
    ...accounts.filter(a => a.tier === 'priority').map(a => a.username),
    '',
    '# --- standard ---',
    ...accounts.filter(a => a.tier === 'standard').map(a => a.username),
    '',
    '# --- low ---',
    ...accounts.filter(a => a.tier === 'low').map(a => a.username),
  ];

  const out = 'accounts.txt';
  fs.writeFileSync(out, lines.join('\n') + '\n');
  console.log('Written ' + accounts.length + ' accounts to ' + out);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
