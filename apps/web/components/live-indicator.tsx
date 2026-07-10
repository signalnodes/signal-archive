"use client";

import { useEffect, useRef, useState } from "react";

interface LiveIndicatorProps {
  accountCount: number;
}

export function LiveIndicator({ accountCount }: LiveIndicatorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
    >
      <span className="inline-flex cursor-pointer items-center rounded-full border border-border/80 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground">
        {accountCount} tracked
      </span>

      {open && (
        <div className="absolute left-0 top-6 z-50 w-56 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
          <p className="mb-1 font-semibold text-foreground">Monitoring active</p>
          <p className="text-muted-foreground">
            Actively monitoring {accountCount} accounts, ingesting tweets and
            checking for deletions.
          </p>
        </div>
      )}
    </div>
  );
}
