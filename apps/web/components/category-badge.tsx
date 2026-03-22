import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, getCategoryVariant } from "@/lib/category";
import type { AccountCategory } from "@taa/shared";

export function CategoryBadge({ category }: { category: AccountCategory | string }) {
  const variant = getCategoryVariant(category as AccountCategory);
  const label = CATEGORY_LABELS[category as AccountCategory] ?? category;
  return <Badge variant={variant} className="font-mono">{label}</Badge>;
}

export function TierBadge({ tier }: { tier: string }) {
  const variant =
    tier === "priority" ? "destructive" : tier === "standard" ? "default" : "outline";
  const label = tier === "priority" ? "Priority" : tier === "standard" ? "Standard" : "Low";
  return (
    <Badge variant={variant} className="font-mono text-xs">
      {label}
    </Badge>
  );
}
