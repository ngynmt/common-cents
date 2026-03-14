/**
 * Upstash Redis client for engagement counters.
 *
 * Used to track:
 * - Bill support/oppose counts
 * - "Contacted representative" counts per bill
 *
 * If Redis is not configured (no env vars), falls back to
 * in-memory counters so the app still works in development.
 */

import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redis;
  }

  return null;
}

// In-memory fallback for development
const memoryCounters: Record<string, number> = {};

/** @internal Clear in-memory counters (for testing only) */
export function _resetMemoryCounters() {
  for (const key of Object.keys(memoryCounters)) {
    delete memoryCounters[key];
  }
}

/**
 * Increment a counter and return the new value.
 */
export async function incrementCounter(key: string): Promise<number> {
  const client = getRedis();
  if (client) {
    return await client.incr(key);
  }
  // In-memory fallback
  memoryCounters[key] = (memoryCounters[key] || 0) + 1;
  return memoryCounters[key];
}

/**
 * Get the current value of a counter.
 */
export async function getCounter(key: string): Promise<number> {
  const client = getRedis();
  if (client) {
    const val = await client.get<number>(key);
    return val ?? 0;
  }
  return memoryCounters[key] || 0;
}

/**
 * Get multiple counters at once.
 */
export async function getCounters(keys: string[]): Promise<Record<string, number>> {
  if (keys.length === 0) return {};

  const client = getRedis();
  if (client) {
    const pipeline = client.pipeline();
    for (const key of keys) {
      pipeline.get(key);
    }
    const results = await pipeline.exec();
    const counters: Record<string, number> = {};
    keys.forEach((key, i) => {
      counters[key] = (results[i] as number) ?? 0;
    });
    return counters;
  }

  // In-memory fallback
  const counters: Record<string, number> = {};
  for (const key of keys) {
    counters[key] = memoryCounters[key] || 0;
  }
  return counters;
}

// Key helpers
export const keys = {
  billSupport: (billId: string) => `bill:${billId}:support`,
  billOppose: (billId: string) => `bill:${billId}:oppose`,
  billContacted: (billId: string) => `bill:${billId}:contacted`,
  rateLimit: (ip: string, route: string = "engagement") => `ratelimit:${route}:${ip}`,
};

/**
 * Simple sliding-window rate limiter.
 * Returns { allowed: true } if under the limit, or { allowed: false, retryAfterSeconds }.
 * Window: 60 seconds, max requests: 10 per IP.
 */
const RATE_LIMIT_WINDOW = 60; // seconds
const RATE_LIMIT_MAX = 10;

// In-memory fallback
const memoryRateLimit: Record<string, { count: number; resetAt: number }> = {};

export async function checkRateLimit(
  ip: string,
  route: string = "engagement",
  max: number = RATE_LIMIT_MAX,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const client = getRedis();
  const key = keys.rateLimit(ip, route);

  if (client) {
    const current = await client.incr(key);
    if (current === 1) {
      await client.expire(key, RATE_LIMIT_WINDOW);
    }
    if (current > max) {
      const ttl = await client.ttl(key);
      return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : RATE_LIMIT_WINDOW };
    }
    return { allowed: true };
  }

  // In-memory fallback
  const now = Date.now();
  const entry = memoryRateLimit[key];
  if (!entry || now > entry.resetAt) {
    memoryRateLimit[key] = { count: 1, resetAt: now + RATE_LIMIT_WINDOW * 1000 };
    return { allowed: true };
  }
  entry.count++;
  if (entry.count > max) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true };
}
