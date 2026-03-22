import { cn } from "@/lib/utils";

interface SeverityBadgeProps {
  score: number;
  className?: string;
}

/**
 * Color-coded severity badge (1-10 scale).
 *
 * - 8-10: Red (critical / high public interest)
 * - 6-7:  Orange (significant)
 * - 4-5:  Yellow (moderate)
 * - 1-3:  Muted (low / mundane)
 */
export function SeverityBadge({ score, className }: SeverityBadgeProps) {
  const color =
    score >= 8
      ? "text-red-600 dark:text-red-400 border-red-500/40 bg-red-500/10"
      : score >= 6
        ? "text-orange-600 dark:text-orange-400 border-orange-400/40 bg-orange-400/10"
        : score >= 4
          ? "text-yellow-600 dark:text-yellow-400 border-yellow-500/40 bg-yellow-500/10"
          : "text-muted-foreground border-border bg-muted/30";

  const label =
    score >= 8
      ? "Critical"
      : score >= 6
        ? "Significant"
        : score >= 4
          ? "Moderate"
          : "Low";

  return (
    <div
      className={cn(
        "text-xs border rounded px-2 py-1 shrink-0 cursor-default select-none text-center leading-tight",
        color,
        className
      )}
      title={`AI severity: ${score}/10, ${label} public interest significance`}
      aria-label={`Severity score ${score} out of 10, ${label}`}
    >
      <div className="text-[10px] font-mono font-bold uppercase tracking-wide">severity</div>
      <div className="font-mono">{score}/10</div>
    </div>
  );
}
