"use client";

import { useCallback, useLayoutEffect } from "react";

import {
	type PopularMovieSeed,
	PopularMoviesInfinite,
} from "@/components/movie/popular-movies-infinite";
import { useWatchlistLobbyDisplayPrefs } from "@/components/watchlist/watchlist-lobby-display-prefs";
import { useWatchlistLobbyParams } from "@/components/watchlist/watchlist-lobby-params-context";
import { WatchlistModeEmpty } from "@/components/watchlist/watchlist-mode-empty";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import { fetchMyWatchlist } from "@/lib/still-api-fetch";
import { useTrackImpressionOnce } from "@/lib/use-track-impression-once";
import {
	type WatchlistLobbyOrder,
	watchlistCatalogueWaveKey,
} from "@/lib/watchlist-lobby-order";

/**
 * Client boundary for the `/watchlist` poster wall — seeds page 1 (server-rendered)
 * and pages the personal list on scroll via `fetchMyWatchlist` (see `loadPage`).
 *
 * `order` is the RSC seed sort, not the optimistic chip value. The chip rail
 * updates immediately; this wall waits for the matching first page so we do not
 * remount onto stale posters (then swap again when the new payload lands).
 * `key` remounts `PopularMoviesInfinite` so tile state initializes from the new
 * seeds on the first paint (the wave-key effect would otherwise lag one frame).
 * Hover prefs come from layout chrome so `?order=` does not wait on `profiles.me`.
 *
 * The page keys this component by sort + providers so the mode impression fires once
 * per distinct grid view.
 */
export function WatchlistLobbyCatalogue({
	order,
	providers,
	seeds,
	totalPages,
	totalResults,
	needsRegion,
	region,
	failed,
}: {
	order: WatchlistLobbyOrder;
	/** Active AND streaming filter — forwarded to `fetchMyWatchlist`. */
	providers: readonly number[];
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	/** Provider filter without a chosen watch region. */
	needsRegion: boolean;
	/** ISO code, `"ALL"`, or null (unset); `undefined` when unknown (skip guidance). */
	region: string | null | undefined;
	/** Page-1 request errored — show retry instead of empty copy. */
	failed: boolean;
}) {
	// Error state is not a mode view — skip the impression when page 1 failed.
	useTrackImpressionOnce(
		"watchlist.mode_viewed",
		{ mode: order, count: seeds.length },
		!failed,
	);
	const { reportSeedOrder, reportGridTotalResults } = useWatchlistLobbyParams();
	const { monochromePeersOnHover, signedIn } = useWatchlistLobbyDisplayPrefs();
	useLayoutEffect(() => {
		reportSeedOrder(order);
		reportGridTotalResults(order, totalResults);
	}, [order, reportGridTotalResults, reportSeedOrder, totalResults]);
	// Stable, media-aware key — used for both React cell keys and cross-page dedupe.
	const cellKey = useCallback(
		(m: PopularMovieSeed) => `${m.listingKind ?? "movie"}:${m.id}`,
		[],
	);

	const loadPage = useCallback(
		async (
			page: number,
			signal?: AbortSignal,
		): Promise<
			{ results: PopularMovieSeed[]; total_pages: number } | { error: true }
		> => {
			return fetchMyWatchlist(page, { order, providers, signal });
		},
		[order, providers],
	);

	if (seeds.length === 0 || failed) {
		return (
			<WatchlistModeEmpty
				order={order}
				needsRegion={needsRegion}
				region={region ?? null}
				failed={failed}
				activeProviderCount={providers.length}
			/>
		);
	}

	return (
		<>
			<PopularMoviesInfinite
				key={watchlistCatalogueWaveKey(order, providers)}
				blockedReason={null}
				catalogueRadialSurface="watchlist"
				catalogueTrackingMode={order}
				signedIn={signedIn}
				catalogMedia="movie"
				catalogExhaustedScope="your watchlist"
				catalogueWaveKeyOverride={watchlistCatalogueWaveKey(order, providers)}
				getPosterCellKey={cellKey}
				getDedupeKey={cellKey}
				loadPage={loadPage}
				gridClassName={HOME_LOBBY_CATALOGUE_GRID_CLASSNAME}
				monochromePeersOnHover={monochromePeersOnHover}
				posterFrameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
				posterHoverEffect="elevation"
				posterLinkClassName={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
				seedMovies={seeds}
				seedPage={1}
				showTitle={false}
				staggerPosterEntrance
				totalPages={totalPages}
				totalResults={totalResults}
			/>
		</>
	);
}
