import { describe, it, expect } from "vitest";
import { CATEGORY_LABELS, TIER_LABELS, getCategoryVariant } from "./category";
import type { AccountCategory } from "@taa/shared";

describe("CATEGORY_LABELS", () => {
  const allCategories: AccountCategory[] = [
    "trump_family",
    "wlfi",
    "political_appointee",
    "white_house",
    "federal_agency",
    "congress",
    "crypto_industry",
    "crypto_caller",
  ];

  it("has a label for every AccountCategory", () => {
    for (const cat of allCategories) {
      expect(CATEGORY_LABELS[cat]).toBeDefined();
      expect(typeof CATEGORY_LABELS[cat]).toBe("string");
      expect(CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
    }
  });
});

describe("TIER_LABELS", () => {
  it("has labels for all three tiers", () => {
    expect(TIER_LABELS.priority).toBe("Priority");
    expect(TIER_LABELS.standard).toBe("Standard");
    expect(TIER_LABELS.low).toBe("Low");
  });
});

describe("getCategoryVariant", () => {
  it('returns "destructive" for hot categories', () => {
    expect(getCategoryVariant("trump_family")).toBe("destructive");
    expect(getCategoryVariant("wlfi")).toBe("destructive");
    expect(getCategoryVariant("political_appointee")).toBe("destructive");
    expect(getCategoryVariant("white_house")).toBe("destructive");
  });

  it('returns "default" for congress and federal_agency', () => {
    expect(getCategoryVariant("congress")).toBe("default");
    expect(getCategoryVariant("federal_agency")).toBe("default");
  });

  it('returns "secondary" for crypto categories', () => {
    expect(getCategoryVariant("crypto_industry")).toBe("secondary");
    expect(getCategoryVariant("crypto_caller")).toBe("secondary");
  });
});
