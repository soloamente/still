import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
	LobbyCatalogChipFallback,
	LobbyStickyChromeFallback,
	LobbyVenueChipFallback,
} from "@/components/app/lobby-suspense-fallbacks";
import { CatalogWatchRegionPrompt } from "@/components/home/catalog-watch-region-prompt";
import { HomeCatalogViewModeToolbar } from "@/components/home/home-catalog-view-mode-toolbar";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import { WatchlistCatalogOrderChips } from "@/components/watchlist/watchlist-catalog-order-chips";
import { WatchlistLobbyCatalogue } from "@/components/watchlist/watchlist-lobby-catalogue";
import { authServer } from "@/lib/auth-server";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import {
	readCatalogMonochromePeersOnHoverPref,
	readCatalogTmdbWatchRegionPref,
} from "@/lib/profile-preferences";
import { serverApi } from "@/lib/server-api";
import {
	isWatchlistRowWithListing,
	parseWatchlistLobbyOrder,
	sortWatchlistLobbyRowsForOrder,
	type WatchlistLobbyRow,
	type WatchlistLobbyRowWithListing,
} from "@/lib/watchlist-lobby-order";

export const metadata: Metadata = { title: "Watchlist" };
export const dynamic = "force-dynamic";

/** Lobby seeds — `listingKind` drives `/tv/` vs `/movies/` links in the shared poster grid. */
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

export default async function WatchlistPage({
	searchParams,
}: {
	searchParams: Promise<{ order?: string }>;
}) {
	const sp = await searchParams;
	const lobbyOrder = parseWatchlistLobbyOrder(sp.order);

	const [session, api] = await Promise.all([authServer(), serverApi()]);
	const [watchlistRes, profileRes] = await Promise.all([
		api.api.watchlist.get().catch(() => ({ data: [] })),
		api.api.profiles.me.get().catch(() => ({ data: null })),
	]);

	const profileData = profileRes.data as {
		handle: string;
		displayName: string;
		preferences?: Record<string, unknown> | null;
	} | null;

	const mePrefs = profileData?.preferences ?? null;
	const monochromePeersOnHover = readCatalogMonochromePeersOnHoverPref(mePrefs);
	const catalogWatchPref = readCatalogTmdbWatchRegionPref(mePrefs);
	const needsCatalogWatchRegionPrompt = Boolean(
		session && catalogWatchPref === null,
	);

	const stickyUser =
		session && profileData?.handle
			? {
					id: session.user.id,
					name: session.user.name ?? profileData.displayName ?? "You",
					image: session.user.image ?? null,
					handle: profileData.handle,
					email: session.user.email ?? null,
				}
			: null;

	const raw = Array.isArray(watchlistRes.data)
		? (watchlistRes.data as WatchlistLobbyRow[])
		: [];

	const withListing = raw.filter(isWatchlistRowWithListing);
	const lobbyRows = sortWatchlistLobbyRowsForOrder(withListing, lobbyOrder);

	const seeds = lobbyRows.map(watchlistRowToPopularSeed);
	const posterCellKeys = lobbyRows.map((r) =>
		r.tv != null ? `tv:${r.item.tvId}` : `m:${r.item.movieId}`,
	);
	const catalogueWaveKeyOverride = `${lobbyOrder}:${posterCellKeys.join("|")}`;
	const hasRows = lobbyRows.length > 0;

	return (
		// Match `/home` + `/diary` shell — fills `<main>` from `AppShell` (`flex-1 min-h-0` + bottom reserve).
		<div className="flex min-h-0 flex-1 flex-col overflow-visible bg-background">
			<Suspense fallback={<LobbyStickyChromeFallback />}>
				<HomeStickyChrome user={stickyUser} />
			</Suspense>

			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"overflow-visible",
				)}
			>
				<div className="flex shrink-0 items-center justify-between gap-3">
					<Suspense fallback={<LobbyCatalogChipFallback />}>
						<WatchlistCatalogOrderChips />
					</Suspense>
					<Suspense fallback={<LobbyVenueChipFallback />}>
						<HomeCatalogViewModeToolbar />
					</Suspense>
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
									<strong className="text-foreground">Watchlist</strong> — it
									will show up in this lobby wall.
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
					/>
				)}
			</section>

			{session ? (
				<CatalogWatchRegionPrompt open={needsCatalogWatchRegionPrompt} />
			) : null}
		</div>
	);
}
