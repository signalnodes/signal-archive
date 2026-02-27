import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { getDb, trackedAccounts } from "@taa/db";
import { LiveIndicator } from "@/components/live-indicator";

export async function SiteHeader() {
  const db = getDb();
  const [result] = await db
    .select({ count: count() })
    .from(trackedAccounts)
    .where(eq(trackedAccounts.isActive, true));

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-screen-xl items-center px-4">
        <div className="mr-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-sm tracking-tight"
          >
            <LiveIndicator accountCount={result?.count ?? 0} />
            <span>Signal Archive</span>
          </Link>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/deletions"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Deletions
          </Link>
          <Link
            href="/search"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Search
          </Link>
          <Link
            href="/accounts"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Accounts
          </Link>
          <Link
            href="/verify"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Verify
          </Link>
          <Link
            href="/about"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
