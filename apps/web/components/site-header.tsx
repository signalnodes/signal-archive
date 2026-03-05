import Link from "next/link";
import { Search } from "lucide-react";
import { count, eq } from "drizzle-orm";
import { getDb, trackedAccounts } from "@taa/db";
import { LiveIndicator } from "@/components/live-indicator";
import { HeaderNav } from "@/components/header-nav";

export async function SiteHeader() {
  const db = getDb();
  const [result] = await db
    .select({ count: count() })
    .from(trackedAccounts)
    .where(eq(trackedAccounts.isActive, true));

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-screen-xl items-center gap-4 px-4 relative">
        <div className="shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-sm tracking-tight"
          >
            <LiveIndicator accountCount={result?.count ?? 0} />
            <span>Signal Archive</span>
          </Link>
        </div>

        <form method="GET" action="/search" className="shrink-0 hidden sm:block">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
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
