import { Skeleton } from "@still/ui/components/skeleton";

/** Stable keys for static poster placeholders (not list data — avoids index keys). */
const APP_LOADING_POSTER_KEYS = [
	"poster-a",
	"poster-b",
	"poster-c",
	"poster-d",
	"poster-e",
	"poster-f",
	"poster-g",
	"poster-h",
	"poster-i",
	"poster-j",
	"poster-k",
	"poster-l",
] as const;

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
			<div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
				{APP_LOADING_POSTER_KEYS.map((key) => (
					<Skeleton key={key} className="aspect-2/3 w-full rounded-2xl" />
				))}
			</div>
		</div>
	);
}
