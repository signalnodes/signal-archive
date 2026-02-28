import { CopyButton } from "@/components/copy-button";
import type { AccountUI } from "@/lib/adapters/account";

interface IdentityTimelineProps {
  account: AccountUI;
}

export function IdentityTimeline({ account }: IdentityTimelineProps) {
  const observedDate = new Date(account.observedSince).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Stable identifiers */}
      <div>
        <h3 className="text-sm font-medium mb-3">Stable Identifiers</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <dt className="text-xs text-muted-foreground w-32 shrink-0">Twitter/X ID</dt>
            <dd className="flex items-center gap-1.5 font-mono text-xs">
              {account.stableUserId}
              <CopyButton text={account.stableUserId} />
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-xs text-muted-foreground w-32 shrink-0">Current handle</dt>
            <dd className="font-mono text-xs">@{account.currentHandle}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-xs text-muted-foreground w-32 shrink-0">Observed since</dt>
            <dd className="text-xs">{observedDate}</dd>
          </div>
          {account.metadata?.createdRegion && (
            <div className="flex items-center gap-2">
              <dt className="text-xs text-muted-foreground w-32 shrink-0">Created region</dt>
              <dd className="text-xs">{account.metadata.createdRegion}</dd>
            </div>
          )}
          {account.metadata?.xAccountCreatedAt && (
            <div className="flex items-center gap-2">
              <dt className="text-xs text-muted-foreground w-32 shrink-0">Account created</dt>
              <dd className="text-xs">
                {new Date(account.metadata.xAccountCreatedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Handle history — placeholder until tracking is live */}
      <div>
        <h3 className="text-sm font-medium mb-2">Handle history</h3>
        <p className="text-xs text-muted-foreground">
          Handle history not yet available. Prospective tracking will log changes
          going forward once enabled.
        </p>
      </div>
    </div>
  );
}
