"use client";

import { IconHeart } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SupporterBadge({ className }: { className?: string }) {
  return (
    <Badge
      className={cn(
        "bg-emerald-950 text-emerald-400 border border-emerald-800 gap-1",
        className,
      )}
    >
      <IconHeart size={10} className="fill-emerald-400 text-emerald-400" />
      Supporter
    </Badge>
  );
}
