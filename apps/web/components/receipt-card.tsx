import { Card, CardContent } from "@/components/ui/card";
import { Chip } from "@/components/chip";
import { CopyButton } from "@/components/copy-button";
import { CategoryBadge } from "@/components/category-badge";
import type { AccountUI } from "@/lib/adapters/account";
import type { AccountCategory } from "@taa/shared";
import Link from "next/link";

interface ReceiptCardProps {
  account: AccountUI;
  latestProofUrl?: string; // /tweet/[id] of most recent attestation
}

export function ReceiptCard({ account, latestProofUrl }: ReceiptCardProps) {
  const isIdentityOnly = account.trackingMode === "IDENTITY_ONLY";

  const coverageSummary = isIdentityOnly
    ? "Identity continuity tracked. Handle changes attested to Hedera."
    : "Statements captured, deletions detected, and cryptographically attested to Hedera.";

  const observedDate = new Date(account.observedSince).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Card className="border-border/60 bg-card mb-6">
      <CardContent className="pt-5 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Left: identity block */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base">@{account.currentHandle}</span>
              {account.displayName && (
                <span className="text-sm text-muted-foreground">{account.displayName}</span>
              )}
              <CategoryBadge category={account.category as AccountCategory} />
              <Chip variant="neutral">
                {account.trackingMode === "FULL_ARCHIVE" ? "Full Archive" : "Identity Only"}
              </Chip>
            </div>

            {/* Stable ID row */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-mono">ID:</span>
              <span className="font-mono">{account.stableUserId}</span>
              <CopyButton text={account.stableUserId} />
            </div>

            {/* Coverage + observed since */}
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
              {coverageSummary} Observed since {observedDate}.
            </p>
          </div>

          {/* Right: latest proof CTA */}
          {latestProofUrl && (
            <div className="shrink-0">
              <Link
                href={latestProofUrl}
                className="inline-flex items-center gap-1 text-xs border border-border rounded px-3 py-1.5 hover:bg-muted transition-colors"
              >
                View latest proof →
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
