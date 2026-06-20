/**
 * Fixed-window rate limiter for public API routes.
 *
 * Backend is chosen at runtime:
 *  - When UPSTASH_REDIS_REST_URL + TOKEN are set, uses a GLOBAL Upstash Redis
 *    limiter (correct on serverless/multi-instance hosts like Vercel).
 *  - Otherwise falls back to a per-instance in-memory limiter (zero infra,
 *    enough to blunt brute-force/form spam on a single instance).
 *
 * Both backends share the same interface, so call sites just `await rateLimit(...)`.
 */
import { env, upstashReady } from "@/lib/env";
import { logger } from "@/lib/logger";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

function inMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - b.count, retryAfterSec: 0 };
}

/** Upstash REST: INCR the key + read its TTL in one pipeline, set expiry on first hit. */
async function upstash(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["PTTL", redisKey],
    ]),
    // Never let the limiter hang a request.
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const out = (await res.json()) as Array<{ result: number }>;
  const count = out[0]!.result;
  let ttl = out[1]!.result; // ms remaining, negative if no expiry yet

  // First hit in this window — set the window expiry.
  if (ttl < 0) {
    await fetch(`${env.UPSTASH_REDIS_REST_URL}/pexpire/${encodeURIComponent(redisKey)}/${windowMs}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
      signal: AbortSignal.timeout(2000),
    });
    ttl = windowMs;
  }

  if (count > limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil(ttl / 1000) };
  }
  return { ok: true, remaining: limit - count, retryAfterSec: 0 };
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (upstashReady) {
    try {
      return await upstash(key, limit, windowMs);
    } catch (err) {
      // A Redis hiccup must not take down the route — fall back to in-memory.
      logger.warn({ err }, "rate-limit: Upstash failed, using in-memory fallback");
      return inMemory(key, limit, windowMs);
    }
  }
  return inMemory(key, limit, windowMs);
}

/** Best-effort client IP from common proxy headers (Vercel/NGINX). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Opportunistic cleanup so the in-memory map can't grow unbounded. */
export function sweepRateLimits(): void {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}
