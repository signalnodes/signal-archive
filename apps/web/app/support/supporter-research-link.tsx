"use client";

import Link from "next/link";
import { useWallet } from "@/lib/wallet/context";

export function SupporterResearchLink() {
  const { isSupporter } = useWallet();

  if (!isSupporter) return null;

  return (
    <div className="mb-6 rounded-lg border border-border bg-muted/40 px-4 py-3 flex items-center justify-between">
      <span className="text-sm text-muted-foreground">You already have Research access.</span>
      <Link
        href="/research"
        className="text-sm font-medium hover:underline"
      >
        Go to Research →
      </Link>
    </div>
  );
}
