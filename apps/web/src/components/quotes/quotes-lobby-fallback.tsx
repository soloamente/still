import { cn } from "@still/ui/lib/utils";

import { QUOTES_LOBBY_CARD_CLASSNAME } from "@/components/quotes/quotes-lobby-listing-meta";

const QUOTES_LOBBY_SKELETON_KEYS = [
	"skeleton-a",
	"skeleton-b",
	"skeleton-c",
	"skeleton-d",
] as const;

/** Editorial quote-card shimmer while `/quotes` seed loads. */
export function QuotesLobbyFallback() {
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
			{QUOTES_LOBBY_SKELETON_KEYS.map((key) => (
				<div
					key={key}
					className={cn(QUOTES_LOBBY_CARD_CLASSNAME, "animate-pulse")}
				>
					<div className="mb-3 h-3 w-6 rounded-full bg-card" />
					<div className="space-y-2.5">
						<div className="h-5 w-full rounded-full bg-card" />
						<div className="h-5 w-11/12 rounded-full bg-card" />
						<div className="h-5 w-3/5 rounded-full bg-card" />
					</div>
					<div className="mt-4 h-3 w-1/3 rounded-full bg-card" />
					<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
						<div className="flex items-center gap-3">
							<div className="aspect-2/3 w-10 shrink-0 rounded-lg bg-card sm:w-11" />
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								<div className="h-3.5 w-28 rounded-full bg-card" />
								<div className="h-3 w-16 rounded-full bg-card" />
							</div>
						</div>
						<div className="flex gap-2">
							<div className="h-10 w-16 rounded-full bg-card" />
							<div className="h-10 w-24 rounded-full bg-card" />
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
