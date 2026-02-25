import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CategoryBadge } from "@/components/category-badge";
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
  } | null;
}

export function RecentDeletionsFeed({ deletions }: { deletions: DeletionRow[] }) {
  if (deletions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        No deletions recorded yet.
      </p>
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
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
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
          {deletion.severityScore != null && deletion.severityScore >= 7 && (
            <div className="text-xs font-mono text-destructive border border-destructive/30 rounded px-2 py-1 shrink-0">
              {deletion.severityScore}/10
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
