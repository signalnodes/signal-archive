import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Chip — Signal Archive's canonical label/tag primitive.
 *
 * Roles:
 *   neutral      Static metadata label (category, tier, type)
 *   deleted      Deletion-related state — restrained red tint
 *   verified     Proof/attestation confirmed — restrained green tint
 *   pending      Awaiting confirmation — restrained yellow tint
 *   accent       Primary-tinted emphasis (priority, live, etc.)
 *   filter       Interactive filter control — inactive state
 *   filter-active Interactive filter control — selected state
 *
 * Usage:
 *   <Chip variant="deleted">Deleted</Chip>
 *   <Chip variant="filter-active" asChild><button onClick={...}>Recent</button></Chip>
 */
const chipVariants = cva(
  "inline-flex items-center justify-center rounded-[6px] border px-2.5 py-1.5 text-[11px] font-mono uppercase tracking-wide whitespace-nowrap shrink-0 leading-none select-none gap-1",
  {
    variants: {
      variant: {
        neutral:
          "border-border bg-muted/20 text-muted-foreground",
        deleted:
          "border-destructive/40 bg-destructive/10 text-destructive",
        verified:
          "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400",
        pending:
          "border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
        accent:
          "border-primary/30 bg-primary/10 text-primary",
        filter:
          "border-border bg-transparent text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "filter-active":
          "border-foreground/50 bg-muted/40 text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

interface ChipProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof chipVariants> {
  asChild?: boolean;
}

function Chip({ className, variant, asChild = false, ...props }: ChipProps) {
  const Comp = asChild ? Slot.Root : "span";
  return (
    <Comp
      className={cn(chipVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Chip, chipVariants };
