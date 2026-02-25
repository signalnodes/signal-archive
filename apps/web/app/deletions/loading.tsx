import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <Skeleton className="h-8 w-40 mb-2" />
      <Skeleton className="h-4 w-72 mb-6" />
      <div className="flex flex-wrap gap-2 mb-6">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
