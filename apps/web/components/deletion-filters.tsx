"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Chip } from "@/components/chip";
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
    params.delete("page");
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
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip variant={activeSort === "recent" ? "filter-active" : "filter"} asChild>
        <button onClick={() => router.push(buildUrl({ sort: "recent" }))}>Recent</button>
      </Chip>
      <Chip variant={activeSort === "severity" ? "filter-active" : "filter"} asChild>
        <button onClick={() => router.push(buildUrl({ sort: "severity" }))}>Highest Severity</button>
      </Chip>

      <Separator orientation="vertical" className="h-4 mx-1" />

      <Chip variant={!activeCategory ? "filter-active" : "filter"} asChild>
        <button onClick={() => router.push(buildUrl({ category: null }))}>All</button>
      </Chip>
      {categories.map((cat) => (
        <Chip
          key={cat}
          variant={activeCategory === cat ? "filter-active" : "filter"}
          asChild
        >
          <button onClick={() => router.push(buildUrl({ category: cat }))}>
            {CATEGORY_LABELS[cat as AccountCategory] ?? cat}
          </button>
        </Chip>
      ))}
    </div>
  );
}
