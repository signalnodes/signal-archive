import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 py-8 mt-16">
      <div className="container mx-auto max-w-screen-xl px-4 flex flex-col gap-4 sm:flex-row sm:justify-between items-center text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <p>Signal Archive: public statements, permanent record.</p>
          <Link
            href="/about"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            About
          </Link>
          <Link
            href="/donate"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Support
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <p>
            Attestations anchored to{" "}
            <a
              href="https://hedera.com"
              className="underline underline-offset-2 hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              Hedera
            </a>
            .
          </p>
          <a
            href="/rss.xml"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
            title="RSS feed"
          >
            RSS
          </a>
        </div>
      </div>
    </footer>
  );
}
