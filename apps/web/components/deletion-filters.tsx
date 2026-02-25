"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS } from "@/lib/category";
import type { AccountCategory } from "@taa/shared";

interface DeletionFiltersProps {
  categories: string[];
  activeCategory: string | null;
}

export function DeletionFilters({ categories, activeCategory }: DeletionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  function setCategory(cat: string | null) {
    const params = cat ? `?category=${encodeURIComponent(cat)}` : "";
    router.push(`${pathname}${params}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={!activeCategory ? "default" : "outline"}
        size="sm"
        onClick={() => setCategory(null)}
      >
        All Categories
      </Button>
      {categories.map((cat) => (
        <Button
          key={cat}
          variant={activeCategory === cat ? "default" : "outline"}
          size="sm"
          onClick={() => setCategory(cat)}
        >
          {CATEGORY_LABELS[cat as AccountCategory] ?? cat}
        </Button>
      ))}
    </div>
  );
}
