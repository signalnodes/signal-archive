/**
 * HBAR/USD rate service.
 *
 * Fetches the current HBAR price from CoinGecko and caches it server-side
 * with a short TTL. Used during donation prepare to lock the rate.
 *
 * The locked rate is stored in the batch store and recorded in the DB
 * and HCS receipt so the USD-equivalent is verifiable on-chain.
 */

const CACHE_TTL_MS = 60_000; // 1 minute
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd";

let cachedRate: number | null = null;
let cacheExpiresAt = 0;

/**
 * Returns the current HBAR/USD rate.
 * Cached for 1 minute to avoid hammering CoinGecko on every prepare call.
 * Throws if the fetch fails and no cached value is available.
 */
export async function getHbarUsdRate(): Promise<number> {
  const now = Date.now();
  if (cachedRate !== null && now < cacheExpiresAt) {
    return cachedRate;
  }

  const res = await fetch(COINGECKO_URL, {
    headers: { Accept: "application/json" },
    // Next.js: skip cache so we always get fresh data server-side
    cache: "no-store",
  });

  if (!res.ok) {
    if (cachedRate !== null) {
      // Stale is better than nothing during a CoinGecko blip
      return cachedRate;
    }
    throw new Error(`CoinGecko fetch failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    "hedera-hashgraph"?: { usd?: number };
  };
  const rate = data["hedera-hashgraph"]?.usd;

  if (!rate || rate <= 0) {
    if (cachedRate !== null) return cachedRate;
    throw new Error("CoinGecko returned invalid HBAR rate");
  }

  cachedRate = rate;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return rate;
}

/**
 * Converts an HBAR amount to USD using the given rate.
 */
export function hbarToUsd(amountHbar: number, rateHbarUsd: number): number {
  return Math.round(amountHbar * rateHbarUsd * 100) / 100;
}
