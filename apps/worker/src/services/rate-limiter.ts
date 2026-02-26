/**
 * Token-bucket rate limiter shared between SocialData provider and deletion checker.
 * SocialData.tools allows 120 requests/minute across all endpoints.
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number = 120,
    private refillRatePerMs: number = 120 / 60_000, // 2 tokens/sec
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRatePerMs,
    );
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait until a token is available
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRatePerMs);
    await sleep(waitMs);
    this.refill();
    this.tokens -= 1;
  }
}

/**
 * Retry a function with exponential backoff on 429 responses.
 * Returns the Response on success, or throws after max retries.
 */
export async function withBackoff(
  fn: () => Promise<Response>,
  maxRetries: number = 3,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fn();

    if (response.status !== 429 || attempt === maxRetries) {
      return response;
    }

    const delayMs = Math.min(2 ** attempt * 1000, 32_000);
    console.warn(
      `[rate-limiter] 429 received, backing off ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`,
    );
    await sleep(delayMs);
  }

  // Unreachable, but TypeScript needs it
  throw new Error("withBackoff: exceeded max retries");
}

// Shared instance — both provider and deletion checker use the same 120/min budget
export const socialDataLimiter = new RateLimiter(120, 120 / 60_000);
