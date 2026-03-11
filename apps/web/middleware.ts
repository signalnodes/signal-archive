import { NextRequest, NextResponse } from "next/server";

// Simple in-memory sliding window rate limiter.
// Runs in Next.js Edge middleware — no ioredis dependency.
// Suitable for single-instance deployment (Railway).

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // per IP per window

// ip → [timestamp, ...]
const counters = new Map<string, number[]>();

// Prune entries older than the window
function getCount(ip: string, now: number): number {
  const hits = counters.get(ip) ?? [];
  const recent = hits.filter((t) => now - t < WINDOW_MS);
  counters.set(ip, recent);
  return recent.length;
}

function record(ip: string, now: number) {
  const hits = counters.get(ip) ?? [];
  hits.push(now);
  counters.set(ip, hits);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only rate-limit API routes; skip health check
  if (!pathname.startsWith("/api/") || pathname === "/api/health") {
    return NextResponse.next();
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const now = Date.now();
  const count = getCount(ip, now);

  if (count >= MAX_REQUESTS) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(WINDOW_MS / 1000)),
          "X-RateLimit-Limit": String(MAX_REQUESTS),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  record(ip, now);

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
  response.headers.set("X-RateLimit-Remaining", String(MAX_REQUESTS - count - 1));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
