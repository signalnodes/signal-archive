import { Chip } from "@/components/chip";
import { CATEGORY_LABELS } from "@/lib/category";
import type { AccountCategory } from "@taa/shared";

export function CategoryBadge({ category }: { category: AccountCategory | string }) {
  const label = CATEGORY_LABELS[category as AccountCategory] ?? category;
  return <Chip variant="neutral">{label}</Chip>;
}

export function TierBadge({ tier }: { tier: string }) {
  const label = tier === "priority" ? "Priority" : tier === "standard" ? "Standard" : "Low";
  const variant = tier === "priority" ? "accent" : "neutral";
  return <Chip variant={variant}>{label}</Chip>;
}
