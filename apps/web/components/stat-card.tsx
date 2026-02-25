import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";

export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-3xl font-bold font-mono tabular-nums">
          {formatNumber(value)}
        </div>
        <div className="text-sm text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}
