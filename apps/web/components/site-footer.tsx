import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 mt-16">
      <div className="container mx-auto max-w-screen-xl px-4 py-6">

        {/* Main row: brand + links */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <p className="font-bold text-sm text-foreground leading-none">Signal Archive</p>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              Public statements. Permanent record. Every tweet archived and attested
              on Hedera before it can be deleted.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <Link href="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="/support" className="hover:text-foreground transition-colors">
              Support
            </Link>
            <a
              href="https://github.com/signalnodes/signal-archive"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://x.com/signalarchives"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              X / Twitter
            </a>
            <a
              href="/rss.xml"
              className="hover:text-foreground transition-colors"
              title="RSS feed"
            >
              RSS
            </a>
          </div>
        </div>

        {/* Edition line */}
        <div className="mt-6 pt-4 border-t border-border/40">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground/40 leading-none">
            Public Record Archive · HCS Topic 0.0.10301350 · Hedera Mainnet · Attestations Open
          </p>
        </div>

      </div>
    </footer>
  );
}
