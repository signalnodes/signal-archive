import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <Skeleton className="h-8 w-24 mb-6" />
      <div className="flex gap-2 mb-6">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-10 w-20" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}
