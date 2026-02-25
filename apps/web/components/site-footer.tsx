export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 py-8 mt-16">
      <div className="container mx-auto max-w-screen-xl px-4 flex flex-col gap-2 sm:flex-row sm:justify-between items-center text-sm text-muted-foreground">
        <p>Tweet Accountability Archive — public statements, permanent record.</p>
        <p>
          Attestations anchored to{" "}
          <a
            href="https://hedera.com"
            className="underline underline-offset-2 hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            Hedera Consensus Service
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
