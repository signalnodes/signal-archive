import { describe, it, expect } from "vitest";
import { formatNumber, formatTweetAge } from "./format";

// Note: relativeTime and absoluteDate are thin wrappers over date-fns
// and not worth unit-testing beyond confirming they don't throw.

describe("formatNumber", () => {
  it("returns '-' for null", () => {
    expect(formatNumber(null)).toBe("-");
  });

  it("returns '-' for undefined", () => {
    expect(formatNumber(undefined)).toBe("-");
  });

  it("formats millions with 1 decimal", () => {
    expect(formatNumber(1_000_000)).toBe("1.0M");
    expect(formatNumber(2_500_000)).toBe("2.5M");
    expect(formatNumber(10_123_456)).toBe("10.1M");
  });

  it("formats numbers below 1M with locale separators", () => {
    const result = formatNumber(999_999);
    // toLocaleString output varies by env; just check it's not 'M' suffixed
    expect(result).not.toContain("M");
    expect(result).not.toBe("-");
  });

  it("formats zero", () => {
    const result = formatNumber(0);
    expect(result).toBe("0");
  });

  it("formats small numbers", () => {
    expect(formatNumber(42)).toBe("42");
  });
});

describe("formatTweetAge", () => {
  it("returns 'unknown age' for null", () => {
    expect(formatTweetAge(null)).toBe("unknown age");
  });

  it("returns 'unknown age' for undefined", () => {
    expect(formatTweetAge(undefined)).toBe("unknown age");
  });

  it("returns 'unknown age' for NaN string", () => {
    expect(formatTweetAge("abc")).toBe("unknown age");
  });

  it("returns 'less than 1 hour old' for fractional hours", () => {
    expect(formatTweetAge(0.5)).toBe("less than 1 hour old");
    expect(formatTweetAge(0)).toBe("less than 1 hour old");
  });

  it("returns singular 'hour' for 1 hour", () => {
    expect(formatTweetAge(1)).toBe("1 hour old");
  });

  it("returns plural 'hours' for multiple hours", () => {
    expect(formatTweetAge(5)).toBe("5 hours old");
    expect(formatTweetAge(23)).toBe("23 hours old");
  });

  it("returns days for 24+ hours", () => {
    expect(formatTweetAge(24)).toBe("1 day old");
    expect(formatTweetAge(48)).toBe("2 days old");
    expect(formatTweetAge(72)).toBe("3 days old");
  });

  it("rounds hours to nearest integer", () => {
    expect(formatTweetAge(5.7)).toBe("6 hours old");
  });

  it("accepts string inputs", () => {
    expect(formatTweetAge("48")).toBe("2 days old");
    expect(formatTweetAge("0.5")).toBe("less than 1 hour old");
  });
});
