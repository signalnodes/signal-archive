import type { AccountCategory } from "@taa/shared";

export const CATEGORY_LABELS: Record<AccountCategory, string> = {
  trump_family: "Trump Family",
  wlfi: "World Liberty Financial",
  political_appointee: "Political Appointee",
  white_house: "White House",
  federal_agency: "Federal Agency",
  congress: "Congress",
  crypto_industry: "Crypto Industry",
  crypto_caller: "Crypto Caller",
};

export const TIER_LABELS: Record<string, string> = {
  priority: "Priority",
  standard: "Standard",
  low: "Low",
};

export function getCategoryVariant(
  category: AccountCategory
): "default" | "secondary" | "destructive" | "outline" {
  const hot: AccountCategory[] = ["trump_family", "wlfi", "political_appointee", "white_house"];
  if (hot.includes(category)) return "destructive";
  if (category === "congress" || category === "federal_agency") return "default";
  return "secondary";
}
