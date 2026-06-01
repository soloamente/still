import { Skeleton } from "@still/ui/components/skeleton";

/** Placeholder while TV community lists + followed ratings stream in. */
export function TvDetailCommunityFallback() {
	return (
		<div
			role="status"
			className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 px-2 py-10"
			aria-busy="true"
			aria-label="Loading community"
		>
			<Skeleton className="h-28 w-full max-w-md rounded-2xl bg-muted/40" />
			<Skeleton className="h-40 w-full rounded-2xl bg-muted/40" />
			<Skeleton className="h-48 w-full rounded-2xl bg-muted/40" />
		</div>
	);
}
