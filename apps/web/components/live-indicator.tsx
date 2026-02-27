"use client";

import { useState, useEffect, useRef } from "react";

interface LiveIndicatorProps {
  accountCount: number;
}

export function LiveIndicator({ accountCount }: LiveIndicatorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
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
      {/* Pulsing dot */}
      <span className="relative flex h-2 w-2 cursor-pointer">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
      </span>

      {/* Popover */}
      {open && (
        <div className="absolute left-0 top-5 z-50 w-56 rounded-md border border-border bg-popover px-3 py-2 shadow-md text-xs text-popover-foreground">
          <p className="font-semibold text-destructive mb-1">● Live</p>
          <p className="text-muted-foreground">
            Actively monitoring {accountCount} accounts — ingesting tweets and
            checking for deletions.
          </p>
        </div>
      )}
    </div>
  );
}
