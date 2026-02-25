import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timestamp } from "@/components/timestamp";
import { formatNumber } from "@/lib/format";

interface TweetEngagement {
  likes?: number;
  retweets?: number;
  replies?: number;
  views?: number;
}

interface TweetCardProps {
  tweet: {
    id: string;
    content: string;
    tweetType: string;
    isDeleted: boolean;
    postedAt: Date;
    engagement?: TweetEngagement | unknown;
    mediaUrls?: string[] | null;
  };
}

export function TweetCard({ tweet }: TweetCardProps) {
  const eng = tweet.engagement as TweetEngagement | null;
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
        <div className="flex items-center justify-between">
          <div className="flex gap-4 text-xs text-muted-foreground">
            {eng && (
              <>
                <span>♥ {formatNumber(eng.likes)}</span>
                <span>↺ {formatNumber(eng.retweets)}</span>
                <span>💬 {formatNumber(eng.replies)}</span>
              </>
            )}
          </div>
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
