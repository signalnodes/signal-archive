import Link from "next/link";
import { CategoryBadge, TierBadge } from "@/components/category-badge";
import { Separator } from "@/components/ui/separator";
import { formatNumber } from "@/lib/format";
import { LetterAvatar } from "@/components/letter-avatar";

interface AccountHeaderProps {
  account: {
    username: string;
    displayName: string | null;
    category: string;
    trackingTier: string;
  };
  stats?: {
    totalTweets: number;
    totalDeletions: number;
  };
  trackingMode?: "FULL_ARCHIVE" | "IDENTITY_ONLY";
}

export function AccountHeader({ account, stats, trackingMode = "FULL_ARCHIVE" }: AccountHeaderProps) {
  const isFullArchive = trackingMode === "FULL_ARCHIVE";

  const deletionRate =
    stats && stats.totalTweets > 0
      ? ((stats.totalDeletions / stats.totalTweets) * 100).toFixed(1)
      : "0.0";
  const isHighDeletion = parseFloat(deletionRate) > 20;

  return (
    <div className="mb-6">
      <div className="flex items-start justify-between flex-wrap gap-6">
        <div className="flex items-start gap-4">
          <LetterAvatar username={account.username} size="lg" />
          <div>
            <h1 className="text-3xl font-bold">@{account.username}</h1>
            {account.displayName && (
              <p className="text-lg text-muted-foreground mt-1">{account.displayName}</p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <CategoryBadge category={account.category} />
              <TierBadge tier={account.trackingTier} />
              <Link
                href={`https://x.com/${account.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View on X ↗
              </Link>
            </div>
          </div>
        </div>

        {/* Stats: only rendered for FULL_ARCHIVE accounts */}
        {isFullArchive && stats && (
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-2xl font-bold font-mono tabular-nums">
                {formatNumber(stats.totalTweets)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Archived</div>
            </div>
            <Separator orientation="vertical" className="h-14" />
            <div>
              <div className="text-2xl font-bold font-mono tabular-nums text-destructive">
                {formatNumber(stats.totalDeletions)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Deleted</div>
            </div>
            <Separator orientation="vertical" className="h-14" />
            <div>
              <div
                className={`text-2xl font-bold font-mono tabular-nums ${
                  isHighDeletion ? "text-destructive" : ""
                }`}
              >
                {deletionRate}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Deletion Rate</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
