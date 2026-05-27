"use client";

import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { useMemo } from "react";

import { HomeCatalogViewModeToolbar } from "@/components/home/home-catalog-view-mode-toolbar";
import { LobbyNavigationProvider } from "@/components/lobby/lobby-navigation-provider";
import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import { WatchlistCatalogOrderChips } from "@/components/watchlist/watchlist-catalog-order-chips";
import { WatchlistLobbyCatalogue } from "@/components/watchlist/watchlist-lobby-catalogue";
import {
	useWatchlistLobbyParams,
	WatchlistLobbyParamsProvider,
} from "@/components/watchlist/watchlist-lobby-params-context";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import {
	isWatchlistRowWithListing,
	sortWatchlistLobbyRowsForOrder,
	type WatchlistLobbyRow,
	type WatchlistLobbyRowWithListing,
} from "@/lib/watchlist-lobby-order";

function watchlistRowToPopularSeed(
	row: WatchlistLobbyRowWithListing,
): PopularMovieSeed {
	const listing = row.movie ?? row.tv;
	if (!listing) {
		throw new Error("watchlistRowToPopularSeed: row missing movie and tv");
	}
	let poster_url: string | null = listing.posterPath;
	if (poster_url?.length && !poster_url.startsWith("http")) {
		const fragment = poster_url.startsWith("/") ? poster_url : `/${poster_url}`;
		poster_url = `https://image.tmdb.org/t/p/w780${fragment}`;
	}
	return {
		id: listing.tmdbId,
		title: listing.title,
		poster_url,
		listingKind: row.tv != null ? "tv" : "movie",
	};
}

export interface WatchlistPatronLobbyShellProps {
	rawRows: WatchlistLobbyRow[];
	monochromePeersOnHover: boolean;
	signedIn: boolean;
}

function WatchlistPatronLobbyBody({
	rawRows,
	monochromePeersOnHover,
	signedIn,
}: WatchlistPatronLobbyShellProps) {
	const { order } = useWatchlistLobbyParams();

	const lobbyRows = useMemo(() => {
		const withListing = rawRows.filter(isWatchlistRowWithListing);
		return sortWatchlistLobbyRowsForOrder(withListing, order);
	}, [rawRows, order]);

	const seeds = useMemo(
		() => lobbyRows.map(watchlistRowToPopularSeed),
		[lobbyRows],
	);
	const posterCellKeys = useMemo(
		() =>
			lobbyRows.map((r) =>
				r.tv != null ? `tv:${r.item.tvId}` : `m:${r.item.movieId}`,
			),
		[lobbyRows],
	);
	const catalogueWaveKeyOverride = `${order}:${posterCellKeys.join("|")}`;
	const hasRows = lobbyRows.length > 0;

	return (
		<section
			className={cn(
				HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
				"overflow-visible",
			)}
		>
			<div className="flex shrink-0 items-center justify-between gap-3">
				<WatchlistCatalogOrderChips />
				<HomeCatalogViewModeToolbar />
			</div>

			{!hasRows ? (
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-6 sm:px-4 sm:py-10">
					<div
						className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border border-dashed bg-card/40 px-6 py-12 text-center sm:px-10 sm:py-14"
						role="status"
					>
						<div className="space-y-2">
							<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
								Your watchlist is empty
							</p>
							<p className="text-muted-foreground text-sm leading-relaxed">
								When something catches your eye, open its page and tap{" "}
								<strong className="text-foreground">Watchlist</strong> — it will
								show up in this lobby wall.
							</p>
						</div>
						<Link
							href="/home"
							className={buttonVariants({
								variant: "outline",
								size: "pill",
							})}
						>
							Search films and shows
						</Link>
					</div>
				</div>
			) : (
				<WatchlistLobbyCatalogue
					catalogueWaveKeyOverride={catalogueWaveKeyOverride}
					monochromePeersOnHover={monochromePeersOnHover}
					posterCellKeys={posterCellKeys}
					seeds={seeds}
					signedIn={signedIn}
				/>
			)}
		</section>
	);
}

/** Client `/watchlist` lobby — order chips filter locally. */
export function WatchlistPatronLobbyShell(
	props: WatchlistPatronLobbyShellProps,
) {
	return (
		<LobbyNavigationProvider>
			<WatchlistLobbyParamsProvider>
				<WatchlistPatronLobbyBody {...props} />
			</WatchlistLobbyParamsProvider>
		</LobbyNavigationProvider>
	);
}
