import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";

interface StatCardProps {
  label: string;
  value: number;
  href?: string;
}

export function StatCard({ label, value, href }: StatCardProps) {
  const card = (
    <Card className={href ? "cursor-pointer hover:border-border transition-colors" : ""}>
      <CardContent className="pt-6">
        <div className="text-3xl font-bold font-mono tabular-nums">
          {formatNumber(value)}
        </div>
        <div className="text-sm text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }
  return card;
}
