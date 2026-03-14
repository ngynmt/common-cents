import { describe, it, expect, vi, beforeEach } from "vitest";

// Ensure tests always use the in-memory fallback, even when Upstash env vars are set (e.g. CI).
vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

const { incrementCounter, getCounter, getCounters, keys, _resetMemoryCounters } = await import("./redis");

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
});
