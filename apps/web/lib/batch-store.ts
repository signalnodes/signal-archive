/**
 * In-memory batch store for the atomic donation prepare→execute flow.
 *
 * Each entry expires after 5 minutes. Single-use: calling markBatchEntryUsed
 * prevents replay of the same batchId.
 *
 * Safe for a single-instance Railway deployment. If the web service ever scales
 * to multiple instances, migrate to Redis using the same interface.
 */

import { randomUUID } from "crypto";

const BATCH_TTL_MS = 5 * 60 * 1000; // 5 minutes

export type DonationTemplate = "A" | "B";

export interface BatchEntry {
  batchId: string;
  accountId: string;
  asset: "hbar" | "usdc";
  amount: number;
  amountUsd: number;
  template: DonationTemplate;
  hbarRate: number | null;
  expiresAt: number;
  used: boolean;
}

const store = new Map<string, BatchEntry>();

export function createBatchEntry(
  entry: Omit<BatchEntry, "batchId" | "expiresAt" | "used">,
): string {
  const batchId = randomUUID();
  store.set(batchId, {
    ...entry,
    batchId,
    expiresAt: Date.now() + BATCH_TTL_MS,
    used: false,
  });
  return batchId;
}

export function getBatchEntry(batchId: string): BatchEntry | null {
  const entry = store.get(batchId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(batchId);
    return null;
  }
  if (entry.used) return null;
  return entry;
}

export function markBatchEntryUsed(batchId: string): void {
  const entry = store.get(batchId);
  if (entry) {
    entry.used = true;
    // Cleanup after a short window (allow receipt polling)
    setTimeout(() => store.delete(batchId), 30_000);
  }
}
