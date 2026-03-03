"use client";

import { Heart } from "lucide-react";
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
      <Heart className="size-2.5 fill-emerald-400 text-emerald-400" />
      Supporter
    </Badge>
  );
}
