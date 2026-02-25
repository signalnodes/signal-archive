import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <div className="flex items-start justify-between flex-wrap gap-6 mb-8">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-32 mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
        <div className="flex gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="text-center">
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-10 w-48 mb-6" />
      <div className="flex flex-col gap-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
