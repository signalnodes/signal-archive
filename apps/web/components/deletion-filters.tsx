"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CATEGORY_LABELS } from "@/lib/category";
import type { AccountCategory } from "@taa/shared";

interface DeletionFiltersProps {
  categories: string[];
  activeCategory: string | null;
  activeSort: "recent" | "severity";
}

export function DeletionFilters({ categories, activeCategory, activeSort }: DeletionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildUrl(overrides: { category?: string | null; sort?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page"); // reset pagination on filter change
    if ("category" in overrides) {
      overrides.category ? params.set("category", overrides.category) : params.delete("category");
    }
    if ("sort" in overrides) {
      overrides.sort && overrides.sort !== "recent"
        ? params.set("sort", overrides.sort)
        : params.delete("sort");
    }
    const qs = params.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Sort controls */}
      <Button
        variant={activeSort === "recent" ? "default" : "outline"}
        size="sm"
        onClick={() => router.push(buildUrl({ sort: "recent" }))}
      >
        Recent
      </Button>
      <Button
        variant={activeSort === "severity" ? "default" : "outline"}
        size="sm"
        onClick={() => router.push(buildUrl({ sort: "severity" }))}
      >
        Highest Severity
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Category filters */}
      <Button
        variant={!activeCategory ? "default" : "outline"}
        size="sm"
        onClick={() => router.push(buildUrl({ category: null }))}
      >
        All Categories
      </Button>
      {categories.map((cat) => (
        <Button
          key={cat}
          variant={activeCategory === cat ? "default" : "outline"}
          size="sm"
          onClick={() => router.push(buildUrl({ category: cat }))}
        >
          {CATEGORY_LABELS[cat as AccountCategory] ?? cat}
        </Button>
      ))}
    </div>
  );
}
