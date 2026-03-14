"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Timestamp } from "@/components/timestamp";
import type { EventUI } from "@/lib/adapters/account";

interface ActivityFeedProps {
  username: string;
}

const EVENT_LABELS: Record<string, string> = {
  STATEMENT_CAPTURED: "Captured",
  STATEMENT_DELETED: "Deleted",
  HANDLE_CHANGED: "Handle changed",
  METADATA_CHANGED: "Metadata changed",
  ATTESTED: "Attested",
};

const EVENT_COLORS: Record<string, string> = {
  STATEMENT_CAPTURED: "text-muted-foreground",
  STATEMENT_DELETED: "text-destructive",
  HANDLE_CHANGED: "text-yellow-500",
  METADATA_CHANGED: "text-muted-foreground",
  ATTESTED: "text-green-500",
};

export function ActivityFeed({ username }: ActivityFeedProps) {
  const [events, setEvents] = useState<EventUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/accounts/${encodeURIComponent(username)}/activity`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [username, retryCount]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-sm text-muted-foreground text-center">
          Failed to load activity.
        </p>
        <button
          onClick={() => setRetryCount((c) => c + 1)}
          className="text-sm px-3 py-1.5 rounded border hover:bg-muted transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No activity recorded yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {events.map((event) => (
        <div key={event.id} className="py-3 flex items-start gap-3">
          <span className={`text-xs font-medium w-28 shrink-0 pt-0.5 ${EVENT_COLORS[event.type] ?? "text-muted-foreground"}`}>
            {EVENT_LABELS[event.type] ?? event.type}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground line-clamp-2 break-words">
              {event.summary}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <Timestamp date={new Date(event.timestamp)} />
              {event.proof?.proofUrl && (
                <Link
                  href={event.proof.proofUrl}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  View proof →
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
