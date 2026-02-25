import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-12">
      <Skeleton className="h-12 w-2/3 mb-4" />
      <Skeleton className="h-5 w-1/2 mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
