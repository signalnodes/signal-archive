import { cn } from "@/lib/utils";

interface SectionOpenerProps {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Compact mode: smaller title, tighter spacing. For within-page sections. */
  compact?: boolean;
  className?: string;
}

export function SectionOpener({
  eyebrow,
  title,
  description,
  compact = false,
  className,
}: SectionOpenerProps) {
  return (
    <div className={cn(compact ? "mb-6" : "mb-8", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 mb-2 leading-none">
        {eyebrow}
      </p>
      <h1
        className={cn(
          "font-editorial font-bold tracking-tight leading-tight",
          compact ? "text-xl" : "text-2xl"
        )}
      >
        {title}
      </h1>
      {description && (
        <p className="text-sm text-muted-foreground leading-relaxed mt-2 max-w-2xl">
          {description}
        </p>
      )}
    </div>
  );
}
