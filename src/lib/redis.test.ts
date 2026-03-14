import { describe, it, expect, beforeEach } from "vitest";
import { incrementCounter, getCounter, getCounters, keys, _resetMemoryCounters } from "./redis";

// These tests run against the in-memory fallback (no Redis env vars in test)
beforeEach(() => {
  _resetMemoryCounters();
});

describe("incrementCounter", () => {
  it("increments from zero", async () => {
    const result = await incrementCounter("test:inc:1");
    expect(result).toBe(1);
  });

  it("increments sequentially", async () => {
    await incrementCounter("test:inc:seq");
    await incrementCounter("test:inc:seq");
    const result = await incrementCounter("test:inc:seq");
    expect(result).toBe(3);
  });
});

describe("getCounter", () => {
  it("returns zero for unknown key", async () => {
    const result = await getCounter("test:get:unknown");
    expect(result).toBe(0);
  });

  it("returns current value after increments", async () => {
    await incrementCounter("test:get:known");
    await incrementCounter("test:get:known");
    const result = await getCounter("test:get:known");
    expect(result).toBe(2);
  });
});

describe("getCounters", () => {
  it("returns empty object for empty keys", async () => {
    const result = await getCounters([]);
    expect(result).toEqual({});
  });

  it("returns zero for unknown keys", async () => {
    const result = await getCounters(["test:batch:a", "test:batch:b"]);
    expect(result).toEqual({
      "test:batch:a": 0,
      "test:batch:b": 0,
    });
  });

  it("returns correct values for mixed keys", async () => {
    await incrementCounter("test:batch:exists");
    await incrementCounter("test:batch:exists");
    const result = await getCounters(["test:batch:exists", "test:batch:missing"]);
    expect(result["test:batch:exists"]).toBe(2);
    expect(result["test:batch:missing"]).toBe(0);
  });
});

describe("keys helpers", () => {
  it("generates correct key formats", () => {
    expect(keys.billSupport("hr-123")).toBe("bill:hr-123:support");
    expect(keys.billOppose("hr-123")).toBe("bill:hr-123:oppose");
    expect(keys.billContacted("hr-123")).toBe("bill:hr-123:contacted");
  });
});
