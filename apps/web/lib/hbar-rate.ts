/**
 * HBAR/USD rate service.
 *
 * Primary source: CoinGecko (market rate, 1-min cache).
 * Fallback: Hedera mirror node /network/exchangerate (no rate limits, always available).
 * Last resort: stale cached value or hardcoded floor.
 */

import { getMirrorBase } from "@/lib/hedera-server";

const CACHE_TTL_MS = 60_000; // 1 minute
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd";

// Conservative fallback if all sources fail (used only as last resort)
const FALLBACK_RATE = 0.15;

let cachedRate: number | null = null;
let cacheExpiresAt = 0;

/** Fetch HBAR/USD from the Hedera mirror node exchange rate endpoint. */
async function getHbarRateFromMirrorNode(): Promise<number> {
  const res = await fetch(`${getMirrorBase()}/api/v1/network/exchangerate`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Mirror node exchange rate failed: ${res.status}`);
  const data = await res.json();
  const cents = data.current_rate?.cent_equivalent;
  const hbars = data.current_rate?.hbar_equivalent;
  if (!cents || !hbars || hbars === 0) throw new Error("Invalid mirror node exchange rate");
  return cents / hbars / 100; // convert cents-per-hbar to USD-per-hbar
}

/**
 * Returns the current HBAR/USD rate.
 * Tries CoinGecko first, falls back to mirror node, then stale cache, then floor.
 */
export async function getHbarUsdRate(): Promise<number> {
  const now = Date.now();
  if (cachedRate !== null && now < cacheExpiresAt) {
    return cachedRate;
  }

  // --- Try CoinGecko ---
  try {
    const res = await fetch(COINGECKO_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as {
        "hedera-hashgraph"?: { usd?: number };
      };
      const rate = data["hedera-hashgraph"]?.usd;
      if (rate && rate > 0) {
        cachedRate = rate;
        cacheExpiresAt = now + CACHE_TTL_MS;
        return rate;
      }
    }
    // 429 or other error — fall through to mirror node
  } catch {
    // network error — fall through
  }

  // --- Try Hedera mirror node exchange rate ---
  try {
    const rate = await getHbarRateFromMirrorNode();
    if (rate > 0) {
      cachedRate = rate;
      cacheExpiresAt = now + CACHE_TTL_MS;
      return rate;
    }
  } catch {
    // fall through
  }

  // --- Stale cache or hardcoded floor ---
  if (cachedRate !== null) return cachedRate;
  return FALLBACK_RATE;
}

/**
 * Converts an HBAR amount to USD using the given rate.
 */
export function hbarToUsd(amountHbar: number, rateHbarUsd: number): number {
  return Math.round(amountHbar * rateHbarUsd * 100) / 100;
}
