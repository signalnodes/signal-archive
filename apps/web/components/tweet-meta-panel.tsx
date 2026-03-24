import Link from "next/link";
import { absoluteDate, formatTweetAge } from "@/lib/format";
import { CopyButton } from "@/components/copy-button";
import { SeverityBadge } from "@/components/severity-badge";

interface AiMeta {
  reasoning?: string;
  confidence?: number;
  model?: string;
}

interface TweetMetaPanelProps {
  tweet: {
    tweetType: string;
    postedAt: Date;
    capturedAt: Date;
    contentHash: string;
    id: string;
  };
  deletion?: {
    detectedAt: Date;
    tweetAgeHours: string | null;
    severityScore?: number | null;
    categoryTags?: string[] | null;
    metadata?: { ai?: AiMeta } | null;
  } | null;
}

export function TweetMetaPanel({ tweet, deletion }: TweetMetaPanelProps) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
      <div>
        <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Posted</dt>
        <dd className="font-mono text-xs">{absoluteDate(tweet.postedAt)}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Captured</dt>
        <dd className="font-mono text-xs">{absoluteDate(tweet.capturedAt)}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Type</dt>
        <dd className="capitalize">{tweet.tweetType}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Content Hash</dt>
        <dd className="flex items-center gap-2 font-mono text-xs">
          <Link
            href={`/verify/${tweet.contentHash}`}
            className="underline underline-offset-2 hover:text-foreground"
          >
            {tweet.contentHash.slice(0, 16)}…
          </Link>
          <CopyButton text={tweet.contentHash} />
        </dd>
      </div>
      {deletion && (
        <>
          <div>
            <dt className="text-xs text-destructive mb-0.5">Deletion Detected</dt>
            <dd className="font-mono text-xs text-destructive">
              {absoluteDate(deletion.detectedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Age at Deletion</dt>
            <dd>{formatTweetAge(deletion.tweetAgeHours)}</dd>
          </div>
          {deletion.severityScore != null && (
            <div className="col-span-2">
              <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">AI Severity Score</dt>
              <dd className="flex items-center gap-3">
                <SeverityBadge score={deletion.severityScore} />
                {deletion.categoryTags && deletion.categoryTags.filter(t => t !== "heuristic_scored").length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {deletion.categoryTags.filter(t => t !== "heuristic_scored").map(tag => (
                      <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
                        {tag.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </dd>
            </div>
          )}
          {deletion.metadata?.ai?.reasoning && (
            <div className="col-span-2" id="ai-analysis">
              <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                AI Analysis
                {deletion.metadata.ai.model && (
                  <span className="ml-1 opacity-50">({deletion.metadata.ai.model})</span>
                )}
              </dt>
              <dd className="text-xs leading-relaxed text-muted-foreground italic">
                {deletion.metadata.ai.reasoning}
              </dd>
            </div>
          )}
        </>
      )}
    </dl>
  );
}
