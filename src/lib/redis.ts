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
    try {
      return await client.incr(key);
    } catch {
      // Redis unavailable — fall through to in-memory
    }
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
    try {
      const val = await client.get<number>(key);
      return val ?? 0;
    } catch {
      // Redis unavailable — fall through to in-memory
    }
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
    try {
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
    } catch {
      // Redis unavailable — fall through to in-memory
    }
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
  geoCache: (zip: string) => `geo:${zip}`,
};

/**
 * Generic JSON cache backed by Redis with in-memory fallback.
 * TTL is in seconds. Returns null on miss.
 */
const memoryCache = new Map<string, { value: string; expiresAt: number }>();
const MAX_CACHE_ENTRIES = 5_000;

export async function getCached<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (client) {
    try {
      const val = await client.get<string>(key);
      if (val) return JSON.parse(val) as T;
      return null;
    } catch {
      // Fall through to in-memory
    }
  }
  const entry = memoryCache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return JSON.parse(entry.value) as T;
  }
  if (entry) memoryCache.delete(key);
  return null;
}

export async function setCached(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const serialized = JSON.stringify(value);
  const client = getRedis();
  if (client) {
    try {
      await client.set(key, serialized, { ex: ttlSeconds });
      return;
    } catch {
      // Fall through to in-memory
    }
  }
  if (memoryCache.size >= MAX_CACHE_ENTRIES) {
    // Evict oldest entries
    const iter = memoryCache.keys();
    for (let i = 0; i < 500; i++) {
      const { value: k } = iter.next();
      if (k) memoryCache.delete(k);
    }
  }
  memoryCache.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/**
 * Simple sliding-window rate limiter.
 * Returns { allowed: true } if under the limit, or { allowed: false, retryAfterSeconds }.
 * Window: 60 seconds, max requests: 10 per IP.
 */
const RATE_LIMIT_WINDOW = 60; // seconds
const RATE_LIMIT_MAX = 10;

// In-memory fallback with bounded size to prevent memory leaks
const MAX_RATE_LIMIT_ENTRIES = 10_000;
const memoryRateLimit = new Map<string, { count: number; resetAt: number }>();

/** Remove expired entries and enforce max size */
function evictStaleEntries() {
  const now = Date.now();
  for (const [key, entry] of memoryRateLimit) {
    if (now > entry.resetAt) {
      memoryRateLimit.delete(key);
    }
  }
  // If still over limit, drop oldest entries
  if (memoryRateLimit.size > MAX_RATE_LIMIT_ENTRIES) {
    const excess = memoryRateLimit.size - MAX_RATE_LIMIT_ENTRIES;
    const iter = memoryRateLimit.keys();
    for (let i = 0; i < excess; i++) {
      const { value } = iter.next();
      if (value) memoryRateLimit.delete(value);
    }
  }
}

export async function checkRateLimit(
  ip: string,
  route: string = "engagement",
  max: number = RATE_LIMIT_MAX,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const client = getRedis();
  const key = keys.rateLimit(ip, route);

  if (client) {
    try {
      const current = await client.incr(key);
      if (current === 1) {
        await client.expire(key, RATE_LIMIT_WINDOW);
      }
      if (current > max) {
        const ttl = await client.ttl(key);
        return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : RATE_LIMIT_WINDOW };
      }
      return { allowed: true };
    } catch {
      // Redis error — fall through to in-memory
    }
  }

  // In-memory fallback
  const now = Date.now();
  const entry = memoryRateLimit.get(key);
  if (!entry || now > entry.resetAt) {
    // Periodically evict stale entries (every ~100 new entries)
    if (memoryRateLimit.size > 0 && memoryRateLimit.size % 100 === 0) {
      evictStaleEntries();
    }
    memoryRateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW * 1000 });
    return { allowed: true };
  }
  entry.count++;
  if (entry.count > max) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true };
}
