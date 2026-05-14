import { Skeleton } from "@still/ui/components/skeleton";

/**
 * Generic shell skeleton for any (app)/ route. Keeps motion subtle so it
 * doesn't grab attention from real content as it arrives.
 */
export default function AppLoading() {
  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[2/3] w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
