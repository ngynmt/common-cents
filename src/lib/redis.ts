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
};
