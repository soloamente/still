import { cn } from "@still/ui/lib/utils";

const QUOTES_LOBBY_SKELETON_KEYS = [
	"skeleton-a",
	"skeleton-b",
	"skeleton-c",
	"skeleton-d",
] as const;

/** Poster-grid shimmer placeholder while `/quotes` seed loads. */
export function QuotesLobbyFallback() {
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-1">
			{QUOTES_LOBBY_SKELETON_KEYS.map((key) => (
				<div
					key={key}
					className={cn(
						"flex animate-pulse gap-4 rounded-2xl bg-background px-4 py-4 sm:px-5",
					)}
				>
					<div className="aspect-2/3 w-16 shrink-0 rounded-xl bg-card" />
					<div className="flex min-w-0 flex-1 flex-col gap-2 py-1">
						<div className="h-4 w-2/5 rounded-full bg-card" />
						<div className="h-3 w-full rounded-full bg-card" />
						<div className="h-3 w-11/12 rounded-full bg-card" />
						<div className="mt-2 h-3 w-1/4 rounded-full bg-card" />
					</div>
				</div>
			))}
		</div>
	);
}
