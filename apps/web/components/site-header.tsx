import Link from "next/link";
import { IconSearch } from "@tabler/icons-react";
import { and, count, eq } from "drizzle-orm";
import { getDb, trackedAccounts } from "@taa/db";
import { LiveIndicator } from "@/components/live-indicator";
import { HeaderNav } from "@/components/header-nav";

export async function SiteHeader() {
  const db = getDb();
  const [result] = await db
    .select({ count: count() })
    .from(trackedAccounts)
    .where(and(eq(trackedAccounts.isActive, true), eq(trackedAccounts.donorOnly, false)));

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-screen-xl px-4 py-4 flex items-center gap-5 relative">

        {/* Masthead brand block */}
        <div className="shrink-0">
          <Link href="/" className="flex flex-col gap-[5px] group">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/50 leading-none group-hover:text-muted-foreground/70 transition-colors">
              Public Record Archive
            </span>
            <span className="flex items-center gap-1.5 font-bold text-sm tracking-tight leading-none">
              <LiveIndicator accountCount={result?.count ?? 0} />
              Signal Archive
            </span>
          </Link>
        </div>

        {/* Search */}
        <form method="GET" action="/search" className="shrink-0 hidden sm:block">
          <div className="relative">
            <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              name="q"
              type="text"
              placeholder="Search..."
              className="h-8 w-44 rounded-md border border-border bg-transparent pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </form>

        <HeaderNav />
      </div>
    </header>
  );
}
