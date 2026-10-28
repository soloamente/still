import { cn } from "@still/ui/lib/utils";

import { QUOTES_SAVED_OUTER_SHELL_CLASSNAME } from "@/components/quotes/quotes-saved-row";
import { QUOTES_SAVED_LOBBY_GRID_CLASSNAME } from "@/lib/quotes-lobby-layout";

const QUOTES_LOBBY_SKELETON_KEYS = [
	"skeleton-a",
	"skeleton-b",
	"skeleton-c",
	"skeleton-d",
] as const;

/** Quote-tile shimmer while `/quotes` seed loads. */
export function QuotesLobbyFallback() {
	return (
		<div className={QUOTES_SAVED_LOBBY_GRID_CLASSNAME}>
			{QUOTES_LOBBY_SKELETON_KEYS.map((key) => (
				<div
					key={key}
					className={cn(
						QUOTES_SAVED_OUTER_SHELL_CLASSNAME,
						"min-w-0 animate-pulse",
					)}
				>
					<div className="aspect-2/3 w-[7.5rem] shrink-0 rounded-[0.9375rem] bg-card sm:w-[9rem]" />
					<div className="flex min-w-0 flex-1 flex-col justify-between px-2">
						<div className="space-y-2">
							<div className="h-3.5 w-full rounded-full bg-card" />
							<div className="h-3.5 w-11/12 rounded-full bg-card" />
							<div className="h-3.5 w-4/5 rounded-full bg-card" />
						</div>
						<div className="mt-4 flex items-center justify-between gap-2">
							<div className="h-8 w-28 rounded-full bg-card" />
							<div className="h-3.5 w-14 rounded-full bg-card/80" />
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
