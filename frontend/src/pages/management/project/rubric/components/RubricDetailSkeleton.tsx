import { Skeleton } from "@/components/ui/skeleton";

export function RubricDetailSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5" aria-busy="true" aria-label="Loading rubric">
      <div className="grid gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20" />)}
      </div>
      <Skeleton className="h-10 w-full max-w-sm" />
      <Skeleton className="h-16" />
      {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24" />)}
    </div>
  );
}
