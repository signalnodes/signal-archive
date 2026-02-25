import { formatDistanceToNow, format } from "date-fns";

export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function absoluteDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy 'at' h:mm a");
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatTweetAge(hours: number | string | null | undefined): string {
  if (hours == null) return "unknown age";
  const h = typeof hours === "string" ? parseFloat(hours) : hours;
  if (isNaN(h)) return "unknown age";
  if (h < 1) return "less than 1 hour old";
  if (h < 24) return `${Math.round(h)} hour${Math.round(h) === 1 ? "" : "s"} old`;
  const days = Math.round(h / 24);
  return `${days} day${days === 1 ? "" : "s"} old`;
}
