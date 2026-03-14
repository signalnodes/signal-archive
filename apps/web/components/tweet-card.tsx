import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timestamp } from "@/components/timestamp";

interface TweetCardProps {
  tweet: {
    id: string;
    tweetId: string;
    content: string;
    tweetType: string;
    isDeleted: boolean;
    postedAt: Date;
    mediaUrls?: string[] | null;
  };
  username: string;
}

export function TweetCard({ tweet, username }: TweetCardProps) {
  return (
    <Card className={tweet.isDeleted ? "border-destructive/40 opacity-75" : ""}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Timestamp date={tweet.postedAt} />
          <div className="flex items-center gap-2 shrink-0">
            {tweet.tweetType !== "tweet" && (
              <Badge variant="outline" className="text-xs capitalize">
                {tweet.tweetType}
              </Badge>
            )}
            {tweet.isDeleted && (
              <Badge variant="destructive" className="text-xs">
                DELETED
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm leading-relaxed mb-3 whitespace-pre-wrap break-words">
          {tweet.content}
        </p>
        {tweet.mediaUrls && tweet.mediaUrls.length > 0 && (
          <p className="text-xs text-muted-foreground mb-2">
            [{tweet.mediaUrls.length} media attachment
            {tweet.mediaUrls.length > 1 ? "s" : ""}]
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          {tweet.isDeleted ? (
            <span className="text-xs text-muted-foreground">Removed from X</span>
          ) : (
            <Link
              href={`https://x.com/${username}/status/${tweet.tweetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              View on X ↗
            </Link>
          )}
          <Link
            href={`/tweet/${tweet.id}`}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            View proof →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
