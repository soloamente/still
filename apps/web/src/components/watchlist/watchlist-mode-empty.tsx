"use client";

import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
	WatchlistRegionAction,
	watchlistRegionGuidanceCopy,
} from "@/components/watchlist/watchlist-region-action";
import type { WatchlistLobbyOrder } from "@/lib/watchlist-lobby-order";

interface WatchlistModeEmptyCopy {
	title: string;
	body: string;
	href: string;
	cta: string;
}

/** Legacy save-order modes share the original empty-watchlist copy. */
const EMPTY_WATCHLIST_COPY: WatchlistModeEmptyCopy = {
	title: "Your watchlist is empty",
	body: "When something catches your eye, tap Watchlist on its page.",
	href: "/home",
	cta: "Search films and shows",
};

/** Exhaustive by type — a new sort fails to compile until it has copy. */
const COPY: Record<WatchlistLobbyOrder, WatchlistModeEmptyCopy> = {
	latest_added: EMPTY_WATCHLIST_COPY,
	earliest_added: EMPTY_WATCHLIST_COPY,
	title_az: EMPTY_WATCHLIST_COPY,
};

/**
 * Borderless raised pill on the `bg-background` empty tile. `ghost` hover is
 * `bg-muted` (same ink as `card`), so the hover wash is foreground-tinted instead.
 */
const EMPTY_PRIMARY_PILL_CLASS = cn(
	buttonVariants({ variant: "ghost", size: "pill" }),
	"border-transparent bg-card text-foreground [@media(hover:hover)]:hover:bg-foreground/10",
);

/** Quiet text-only secondary action — no fill, no border. */
const EMPTY_SECONDARY_PILL_CLASS = cn(
	buttonVariants({ variant: "ghost", size: "pill" }),
	"border-transparent text-muted-foreground [@media(hover:hover)]:hover:bg-foreground/10 [@media(hover:hover)]:hover:text-foreground",
);

/** Per-mode empty, region-missing, and error states for `/watchlist`. */
export function WatchlistModeEmpty({
	order,
	needsRegion,
	region,
	failed,
	activeProviderCount = 0,
}: {
	order: WatchlistLobbyOrder;
	needsRegion: boolean;
	/** Server region signal: ISO code, `"ALL"`, or null (unset). */
	region: string | null;
	failed: boolean;
	/** Non-zero when `?providers=` filtered the grid to zero rows. */
	activeProviderCount?: number;
}) {
	const router = useRouter();
	const copy = COPY[order];
	const title = failed
		? "Couldn't load your watchlist"
		: needsRegion
			? "Pick your streaming region"
			: copy.title;
	const body = failed
		? "Something went wrong on our side."
		: needsRegion
			? watchlistRegionGuidanceCopy(region)
			: copy.body;
	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-6 sm:px-4 sm:py-10">
			<div
				// Errors announce assertively; empty/region states stay polite.
				role={failed ? "alert" : "status"}
				className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-background px-6 py-12 text-center sm:px-10 sm:py-14"
			>
				<div className="space-y-2">
					<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
						{title}
					</p>
					<p className="text-pretty text-muted-foreground text-sm leading-relaxed">
						{body}
					</p>
				</div>
				{failed ? (
					// Re-run the RSC fetch for the current `?order=` without a full reload.
					<button
						type="button"
						className={EMPTY_PRIMARY_PILL_CLASS}
						onClick={() => router.refresh()}
					>
						Try again
					</button>
				) : needsRegion ? (
					<WatchlistRegionAction className={EMPTY_PRIMARY_PILL_CLASS}>
						Choose region
					</WatchlistRegionAction>
				) : (
					<div className="flex flex-wrap items-center justify-center gap-2">
						<Link href={copy.href} className={EMPTY_PRIMARY_PILL_CLASS}>
							{copy.cta}
						</Link>
						{activeProviderCount > 0 ? (
							// AND filter with zero matches — unfiltered saves may still exist.
							<Link href="/watchlist" className={EMPTY_SECONDARY_PILL_CLASS}>
								See all saves
							</Link>
						) : null}
					</div>
				)}
			</div>
		</div>
	);
}
