import { describe, it, expect } from "vitest";
import {
  TIER_INTERVALS,
  DELETION_CHECK_THRESHOLDS,
  QUEUE_NAMES,
  TIER_PRIORITIES,
  JITTER_FACTOR,
} from "./constants";

describe("TIER_INTERVALS", () => {
  it("priority is shorter than standard, standard shorter than low", () => {
    expect(TIER_INTERVALS.priority).toBeLessThan(TIER_INTERVALS.standard);
    expect(TIER_INTERVALS.standard).toBeLessThan(TIER_INTERVALS.low);
  });

  it("priority is 30 minutes", () => {
    expect(TIER_INTERVALS.priority).toBe(30 * 60 * 1000);
  });
});

describe("QUEUE_NAMES", () => {
  it("has all expected queues", () => {
    expect(QUEUE_NAMES).toEqual({
      INGESTION: "ingestion",
      DELETION_CHECK: "deletion-check",
      HCS_SUBMIT: "hcs-submit",
      MEDIA_ARCHIVE: "media-archive",
    });
  });
});

describe("TIER_PRIORITIES", () => {
  it("priority has lowest number (highest BullMQ priority)", () => {
    expect(TIER_PRIORITIES.priority).toBeLessThan(TIER_PRIORITIES.standard);
    expect(TIER_PRIORITIES.standard).toBeLessThan(TIER_PRIORITIES.low);
  });
});

describe("DELETION_CHECK_THRESHOLDS", () => {
  it("day ranges increase: RECENT < MEDIUM < OLD", () => {
    expect(DELETION_CHECK_THRESHOLDS.RECENT_DAYS).toBeLessThan(
      DELETION_CHECK_THRESHOLDS.MEDIUM_DAYS
    );
    expect(DELETION_CHECK_THRESHOLDS.MEDIUM_DAYS).toBeLessThan(
      DELETION_CHECK_THRESHOLDS.OLD_DAYS
    );
  });
});

describe("JITTER_FACTOR", () => {
  it("is 0.3 (±30%)", () => {
    expect(JITTER_FACTOR).toBe(0.3);
  });
});
