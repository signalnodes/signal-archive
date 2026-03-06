/**
 * In-memory supporter cache for the Railway web process.
 * Avoids a DB round-trip on every wallet check.
 * Positive entries (isSupporter=true) are cached for 1 hour.
 * Negative entries are cached for 60 seconds so new donors
 * get recognized quickly without hammering the DB.
 */

import { eq } from "drizzle-orm";
import { getDb, supporters } from "@taa/db";

// Minimum per-donation amounts to qualify as a supporter
export const MIN_HBAR = 100; // conservative floor: $10 at $0.10/HBAR
export const MIN_USDC = 10;

const TTL_SUPPORTER_MS = 60 * 60 * 1000; // 1 hour
const TTL_VISITOR_MS = 60 * 1000;         // 60 seconds

interface CacheEntry {
  isSupporter: boolean;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(walletAddress: string): boolean | null {
  const entry = cache.get(walletAddress);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(walletAddress);
    return null;
  }
  return entry.isSupporter;
}

export function setSupporter(walletAddress: string, isSupporter: boolean): void {
  cache.set(walletAddress, {
    isSupporter,
    expiresAt: Date.now() + (isSupporter ? TTL_SUPPORTER_MS : TTL_VISITOR_MS),
  });
}

export function invalidateSupporter(walletAddress: string): void {
  cache.delete(walletAddress);
}

/** Check supporter status — cache first, DB fallback. */
export async function isSupporter(walletAddress: string): Promise<boolean> {
  const cached = getCached(walletAddress);
  if (cached !== null) return cached;

  const db = getDb();
  const rows = await db
    .select({ id: supporters.id })
    .from(supporters)
    .where(eq(supporters.walletAddress, walletAddress))
    .limit(1);

  const result = rows.length > 0;
  setSupporter(walletAddress, result);
  return result;
}
