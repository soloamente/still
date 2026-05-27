import { Skeleton } from "@still/ui/components/skeleton";

/** Shown while `MovieDetailAboutAsync` streams reviews/lists/awards. */
export function MovieDetailAboutFallback() {
	return (
		<div
			role="status"
			className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-2.5 py-8 sm:px-3"
			aria-busy="true"
			aria-label="Loading film details"
		>
			<Skeleton className="h-48 w-full rounded-3xl bg-muted/40" />
			<Skeleton className="h-32 w-full rounded-3xl bg-muted/40" />
			<Skeleton className="h-64 w-full rounded-3xl bg-muted/40" />
		</div>
	);
}
