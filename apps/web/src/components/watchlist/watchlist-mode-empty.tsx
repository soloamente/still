"use client";

import { buttonVariants } from "@still/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

/** Exhaustive by type — a new mode fails to compile until it has copy. */
const COPY: Record<WatchlistLobbyOrder, WatchlistModeEmptyCopy> = {
	tonight: {
		title: "Nothing lined up yet",
		body: "Save a few titles and we'll line up tonight's.",
		href: "/home",
		cta: "Browse films",
	},
	available: {
		title: "Nothing on your services yet",
		body: "We'll show titles here as they land on your streaming services.",
		href: "/home",
		cta: "Browse films",
	},
	continue: {
		title: "No shows in progress",
		body: "Start a show and it'll wait for you here.",
		href: "/home?browse=tv",
		cta: "Browse TV",
	},
	latest_added: EMPTY_WATCHLIST_COPY,
	earliest_added: EMPTY_WATCHLIST_COPY,
	title_az: EMPTY_WATCHLIST_COPY,
};

/** `order=available` with no watch region — region control lives in Settings → Catalogue. */
const NEEDS_REGION_COPY: WatchlistModeEmptyCopy = {
	title: "Pick your streaming region",
	body: "Now available needs to know which country's services to check.",
	href: "/me/settings/catalogue",
	cta: "Choose region",
};

/** Per-mode empty, region-missing, and error states for `/watchlist`. */
export function WatchlistModeEmpty({
	order,
	needsRegion,
	failed,
}: {
	order: WatchlistLobbyOrder;
	needsRegion: boolean;
	failed: boolean;
}) {
	const router = useRouter();
	const copy = needsRegion ? NEEDS_REGION_COPY : COPY[order];
	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-6 sm:px-4 sm:py-10">
			<div
				role="status"
				className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-background px-6 py-12 text-center sm:px-10 sm:py-14"
			>
				<div className="space-y-2">
					<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
						{failed ? "Couldn't load your watchlist" : copy.title}
					</p>
					<p className="text-pretty text-muted-foreground text-sm leading-relaxed">
						{failed ? "Something went wrong on our side." : copy.body}
					</p>
				</div>
				{failed ? (
					// Re-run the RSC fetch for the current `?order=` without a full reload.
					<button
						type="button"
						className={buttonVariants({ variant: "outline", size: "pill" })}
						onClick={() => router.refresh()}
					>
						Try again
					</button>
				) : (
					<Link
						href={copy.href}
						className={buttonVariants({ variant: "outline", size: "pill" })}
					>
						{copy.cta}
					</Link>
				)}
			</div>
		</div>
	);
}
