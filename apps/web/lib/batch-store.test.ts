import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createBatchEntry,
  getBatchEntry,
  markBatchEntryUsed,
} from "./batch-store";

describe("batch-store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleEntry = {
    accountId: "0.0.12345",
    asset: "hbar" as const,
    amount: 100,
    amountUsd: 10,
    template: "A" as const,
    hbarRate: 0.1,
  };

  it("creates and retrieves a batch entry", () => {
    const batchId = createBatchEntry(sampleEntry);
    expect(typeof batchId).toBe("string");
    expect(batchId.length).toBeGreaterThan(0);

    const entry = getBatchEntry(batchId);
    expect(entry).not.toBeNull();
    expect(entry!.accountId).toBe("0.0.12345");
    expect(entry!.asset).toBe("hbar");
    expect(entry!.amount).toBe(100);
    expect(entry!.template).toBe("A");
    expect(entry!.used).toBe(false);
  });

  it("returns null for unknown batchId", () => {
    expect(getBatchEntry("nonexistent-id")).toBeNull();
  });

  it("returns null after entry expires (5 minutes)", () => {
    const batchId = createBatchEntry(sampleEntry);
    expect(getBatchEntry(batchId)).not.toBeNull();

    // Advance time past 5 minute TTL
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    expect(getBatchEntry(batchId)).toBeNull();
  });

  it("returns null after entry is marked used (single-use)", () => {
    const batchId = createBatchEntry(sampleEntry);
    expect(getBatchEntry(batchId)).not.toBeNull();

    markBatchEntryUsed(batchId);

    expect(getBatchEntry(batchId)).toBeNull();
  });

  it("generates unique batchIds", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      ids.add(createBatchEntry(sampleEntry));
    }
    expect(ids.size).toBe(50);
  });

  it("handles marking a nonexistent entry as used without error", () => {
    expect(() => markBatchEntryUsed("does-not-exist")).not.toThrow();
  });
});
