"use client";

import { useState, useEffect } from "react";
import { relativeTime, absoluteDate } from "@/lib/format";

export function Timestamp({ date }: { date: Date | string }) {
  const [relative, setRelative] = useState<string | null>(null);

  useEffect(() => {
    setRelative(relativeTime(date));
    const interval = setInterval(() => setRelative(relativeTime(date)), 60_000);
    return () => clearInterval(interval);
  }, [date]);

  const abs = absoluteDate(date);
  return (
    <time
      dateTime={new Date(date).toISOString()}
      title={abs}
      className="text-muted-foreground text-sm"
    >
      {relative ?? abs}
    </time>
  );
}
