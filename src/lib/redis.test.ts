import { describe, it, expect, vi, beforeEach } from "vitest";

// Ensure tests always use the in-memory fallback, even when Upstash env vars are set (e.g. CI).
vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

const { incrementCounter, getCounter, getCounters, checkRateLimit, keys, _resetMemoryCounters } = await import("./redis");

// Use unique keys per test to avoid cross-test pollution from the shared module-level Map.
let testId = 0;
beforeEach(() => {
  _resetMemoryCounters();
  testId++;
});

function key(name: string) {
  return `test:${testId}:${name}`;
}

describe("incrementCounter", () => {
  it("increments from zero", async () => {
    const result = await incrementCounter(key("inc"));
    expect(result).toBe(1);
  });

  it("increments sequentially", async () => {
    const k = key("seq");
    await incrementCounter(k);
    await incrementCounter(k);
    const result = await incrementCounter(k);
    expect(result).toBe(3);
  });
});

describe("getCounter", () => {
  it("returns zero for unknown key", async () => {
    const result = await getCounter(key("unknown"));
    expect(result).toBe(0);
  });

  it("returns current value after increments", async () => {
    const k = key("known");
    await incrementCounter(k);
    await incrementCounter(k);
    const result = await getCounter(k);
    expect(result).toBe(2);
  });
});

describe("getCounters", () => {
  it("returns empty object for empty keys", async () => {
    const result = await getCounters([]);
    expect(result).toEqual({});
  });

  it("returns zero for unknown keys", async () => {
    const a = key("a");
    const b = key("b");
    const result = await getCounters([a, b]);
    expect(result).toEqual({ [a]: 0, [b]: 0 });
  });

  it("returns correct values for mixed keys", async () => {
    const exists = key("exists");
    const missing = key("missing");
    await incrementCounter(exists);
    await incrementCounter(exists);
    const result = await getCounters([exists, missing]);
    expect(result[exists]).toBe(2);
    expect(result[missing]).toBe(0);
  });
});

describe("keys helpers", () => {
  it("generates correct key formats", () => {
    expect(keys.billSupport("hr-123")).toBe("bill:hr-123:support");
    expect(keys.billOppose("hr-123")).toBe("bill:hr-123:oppose");
    expect(keys.billContacted("hr-123")).toBe("bill:hr-123:contacted");
  });

  it("generates rate limit keys with route", () => {
    expect(keys.rateLimit("1.2.3.4", "lobbying")).toBe("ratelimit:lobbying:1.2.3.4");
    expect(keys.rateLimit("1.2.3.4")).toBe("ratelimit:engagement:1.2.3.4");
  });
});

describe("checkRateLimit (in-memory)", () => {
  it("allows requests under the limit", async () => {
    const result = await checkRateLimit("10.0.0.1", "test-route", 5);
    expect(result.allowed).toBe(true);
  });

  it("allows up to max requests", async () => {
    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit("10.0.0.2", "test-route", 5);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks after exceeding the limit", async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit("10.0.0.3", "test-route", 5);
    }
    const result = await checkRateLimit("10.0.0.3", "test-route", 5);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks routes independently", async () => {
    for (let i = 0; i < 3; i++) {
      await checkRateLimit("10.0.0.4", "route-a", 3);
    }
    // route-a is at limit, route-b should still be allowed
    const resultA = await checkRateLimit("10.0.0.4", "route-a", 3);
    const resultB = await checkRateLimit("10.0.0.4", "route-b", 3);
    expect(resultA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);
  });

  it("tracks IPs independently", async () => {
    for (let i = 0; i < 3; i++) {
      await checkRateLimit("10.0.0.5", "test-route", 3);
    }
    // 10.0.0.5 is at limit, different IP should still be allowed
    const blocked = await checkRateLimit("10.0.0.5", "test-route", 3);
    const allowed = await checkRateLimit("10.0.0.6", "test-route", 3);
    expect(blocked.allowed).toBe(false);
    expect(allowed.allowed).toBe(true);
  });
});
