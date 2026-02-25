import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-40 rounded-lg mb-6" />
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
        <Skeleton className="h-px mb-6" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  );
}
