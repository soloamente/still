import { Skeleton } from "@still/ui/components/skeleton";

export default function ProfileLoading() {
  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 xl:-mx-12 2xl:-mx-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 md:flex-row md:px-6 md:py-20">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-14 w-72" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 md:px-6">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
