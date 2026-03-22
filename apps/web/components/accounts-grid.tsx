"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/chip";
import { CategoryBadge, TierBadge } from "@/components/category-badge";
import { AccountAvatar } from "@/components/account-avatar";
import { CATEGORY_LABELS } from "@/lib/category";
import { formatNumber } from "@/lib/format";
import type { AccountCategory } from "@taa/shared";

export interface AccountRow {
  id: string;
  username: string;
  displayName: string | null;
  category: string;
  trackingTier: string;
  avatarUrl: string | null;
  tweetCount: number;
  deletionCount: number;
}

export function AccountsGrid({ accounts }: { accounts: AccountRow[] }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [...new Set(accounts.map((a) => a.category))].sort();

  const matchesSearch = (a: AccountRow) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      a.username.toLowerCase().includes(q) ||
      (a.displayName?.toLowerCase().includes(q) ?? false)
    );
  };

  const searchFiltered = accounts.filter(matchesSearch);
  const filtered = searchFiltered.filter((a) =>
    activeCategory ? a.category === activeCategory : true
  );

  return (
    <div>
      <Input
        placeholder="Search accounts…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-xs mb-4"
      />
      <div className="flex flex-wrap gap-1.5 mb-6">
        <Chip
          variant={activeCategory === null ? "filter-active" : "filter"}
          asChild
        >
          <button onClick={() => setActiveCategory(null)}>
            All ({searchFiltered.length})
          </button>
        </Chip>
        {categories.map((cat) => {
          const catFiltered = searchFiltered.filter((a) => a.category === cat);
          return (
            <Chip
              key={cat}
              variant={activeCategory === cat ? "filter-active" : "filter"}
              asChild
            >
              <button onClick={() => setActiveCategory(cat)}>
                {CATEGORY_LABELS[cat as AccountCategory] ?? cat}
                <span className="opacity-50">({catFiltered.length})</span>
              </button>
            </Chip>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((account) => (
          <Link key={account.id} href={`/accounts/${account.username}`}>
            <Card className="hover:border-border/80 transition-colors h-full cursor-pointer">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3 mb-3">
                  <AccountAvatar username={account.username} avatarUrl={account.avatarUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div className="font-semibold text-sm">@{account.username}</div>
                      <TierBadge tier={account.trackingTier} />
                    </div>
                    {account.displayName && (
                      <div className="text-xs text-muted-foreground truncate">
                        {account.displayName}
                      </div>
                    )}
                  </div>
                </div>
                <CategoryBadge category={account.category} />
                <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                  <span>{formatNumber(account.tweetCount)} archived</span>
                  <span className={account.deletionCount > 0 ? "text-destructive" : ""}>
                    {formatNumber(account.deletionCount)} deleted
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
