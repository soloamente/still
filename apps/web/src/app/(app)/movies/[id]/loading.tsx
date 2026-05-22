import { Skeleton } from "@still/ui/components/skeleton";

export default function MovieLoading() {
	return (
		<div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2">
			<div className="mx-auto flex max-w-7xl flex-col gap-8 px-3 py-12 sm:px-4 md:flex-row md:gap-8 md:px-5 md:py-20">
				<Skeleton className="aspect-2/3 w-full shrink-0 rounded-[1.25rem] md:w-64 lg:w-72" />
				<div className="flex-1 space-y-3">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-14 w-3/4" />
					<Skeleton className="h-5 w-2/3" />
					<Skeleton className="h-4 w-1/3" />
				</div>
			</div>
			<div className="mx-auto max-w-7xl space-y-6 px-3 sm:px-4 md:px-5">
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-32 w-full" />
			</div>
		</div>
	);
}
