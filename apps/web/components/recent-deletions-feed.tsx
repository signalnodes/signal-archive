import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CategoryBadge } from "@/components/category-badge";
import { AccountAvatar } from "@/components/account-avatar";
import { SeverityBadge } from "@/components/severity-badge";
import { Timestamp } from "@/components/timestamp";
import { formatTweetAge } from "@/lib/format";

export interface DeletionRow {
  deletion: {
    id: string;
    tweetId: string | null;
    contentPreview: string | null;
    detectedAt: Date;
    tweetAgeHours: string | null;
    severityScore: number | null;
  };
  account: {
    id: string;
    username: string;
    displayName: string | null;
    category: string;
    avatarUrl?: string | null;
  } | null;
}

export function RecentDeletionsFeed({ deletions }: { deletions: DeletionRow[] }) {
  if (deletions.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">No deletions recorded yet.</p>
        <p className="text-xs text-muted-foreground/70 mt-2">
          Deletions appear after a statement is captured and later removed.
        </p>
        <p className="text-xs mt-3">
          <a href="/about" className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
            How detection works
          </a>
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {deletions.map((row) => (
        <DeletionCard key={row.deletion.id} row={row} />
      ))}
    </div>
  );
}

function DeletionCard({ row }: { row: DeletionRow }) {
  const { deletion, account } = row;
  return (
    <Card className="border-l-2 border-l-destructive/50">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {account && <AccountAvatar username={account.username} avatarUrl={account.avatarUrl} size="sm" />}
              {account && (
                <Link
                  href={`/accounts/${account.username}`}
                  className="font-semibold text-sm hover:underline"
                >
                  @{account.username}
                </Link>
              )}
              {account && <CategoryBadge category={account.category} />}
            </div>
            {deletion.contentPreview && (
              <p className="text-sm text-muted-foreground line-clamp-3 font-mono leading-relaxed border-l-2 border-muted pl-3 mb-3">
                {deletion.contentPreview}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span>
                Detected <Timestamp date={deletion.detectedAt} />
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span>{formatTweetAge(deletion.tweetAgeHours)}</span>
              {deletion.tweetId && (
                <>
                  <Separator orientation="vertical" className="h-3" />
                  <Link
                    href={`/tweet/${deletion.tweetId}`}
                    className="hover:text-foreground hover:underline"
                  >
                    View proof →
                  </Link>
                </>
              )}
            </div>
          </div>
          {deletion.severityScore != null && (
            <SeverityBadge score={deletion.severityScore} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
