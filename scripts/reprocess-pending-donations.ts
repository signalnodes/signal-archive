/**
 * Re-verifies all pending donations against the Hedera mirror node.
 * Run this to recover donations that were stuck in "pending" status
 * due to mirror node lag at the time of the original verification.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/reprocess-pending-donations.ts
 */

import { eq, sql } from "drizzle-orm";
import { getDb, donations, supporters } from "@taa/db";

const MIRROR_BASE = "https://mainnet-public.mirrornode.hedera.com";
const DONATION_ACCOUNT_ID = process.env.NEXT_PUBLIC_DONATION_ACCOUNT_ID ?? "";
const USDC_TOKEN_ID = process.env.NEXT_PUBLIC_USDC_TOKEN_ID ?? "0.0.456858";
const MIN_HBAR = 50;
const MIN_USDC = 5;

async function verifyTx(txId: string, asset: "hbar" | "usdc") {
  const normalizedTxId = txId.replace(/@/g, "-");
  const res = await fetch(`${MIRROR_BASE}/api/v1/transactions/${normalizedTxId}`);
  if (!res.ok) return null;

  const data = await res.json();
  const tx = data.transactions?.[0];
  if (!tx || tx.result !== "SUCCESS") return null;

  if (asset === "hbar") {
    const transfer = tx.transfers?.find(
      (t: { account: string; amount: number }) => t.account === DONATION_ACCOUNT_ID && t.amount > 0
    );
    if (!transfer) return null;
    return { amount: transfer.amount / 100_000_000, amountUsd: null };
  }

  const transfer = tx.token_transfers?.find(
    (t: { token_id: string; account: string; amount: number }) =>
      t.token_id === USDC_TOKEN_ID && t.account === DONATION_ACCOUNT_ID && t.amount > 0
  );
  if (!transfer) return null;
  const amount = transfer.amount / 1_000_000;
  return { amount, amountUsd: String(amount) };
}

async function main() {
  const db = getDb();

  const pending = await db
    .select()
    .from(donations)
    .where(eq(donations.status, "pending"));

  if (pending.length === 0) {
    console.log("No pending donations found.");
    return;
  }

  console.log(`Found ${pending.length} pending donation(s). Re-verifying...\n`);

  for (const donation of pending) {
    const asset = donation.asset as "hbar" | "usdc";
    process.stdout.write(`  ${donation.transactionId} (${asset}) ... `);

    const result = await verifyTx(donation.transactionId, asset);

    if (!result) {
      console.log("still unconfirmed on mirror node — skipping");
      continue;
    }

    const now = new Date();

    // Upgrade donation to confirmed
    await db
      .update(donations)
      .set({
        amount: String(result.amount),
        amountUsd: result.amountUsd,
        status: "confirmed",
        confirmedAt: now,
      })
      .where(eq(donations.transactionId, donation.transactionId));

    const meetsThreshold = asset === "usdc"
      ? result.amount >= MIN_USDC
      : result.amount >= MIN_HBAR;

    if (meetsThreshold) {
      await db
        .insert(supporters)
        .values({
          walletAddress: donation.walletAddress,
          totalDonatedUsd: result.amountUsd ?? "0",
          firstDonationAt: now,
          lastDonationAt: now,
        })
        .onConflictDoUpdate({
          target: supporters.walletAddress,
          set: {
            totalDonatedUsd: result.amountUsd
              ? sql`${supporters.totalDonatedUsd} + ${result.amountUsd}`
              : supporters.totalDonatedUsd,
            lastDonationAt: now,
          },
        });
      console.log(`confirmed — ${result.amount} ${asset.toUpperCase()} — supporter status granted ✓`);
    } else {
      console.log(`confirmed — ${result.amount} ${asset.toUpperCase()} — below threshold, no supporter status`);
    }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
