import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { CatalogWatchRegionPrompt } from "@/components/home/catalog-watch-region-prompt";
import { HomeCatalogSortChips } from "@/components/home/home-catalog-sort-chips";
import { HomeCatalogViewModeToolbar } from "@/components/home/home-catalog-view-mode-toolbar";
import { HomeLobbySessionRestore } from "@/components/home/home-lobby-session-restore";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { PopularMoviesInfinite } from "@/components/movie/popular-movies-infinite";
import { authServer } from "@/lib/auth-server";
import { parseHomeBrowseSurface } from "@/lib/home-browse-surface";
import { parseHomeCatalogSort } from "@/lib/home-catalog-sort";
import {
	HOME_COMMUNITY_FEEDS,
	parseHomeCommunityFeed,
} from "@/lib/home-community-feed";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
	HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import { parseHomeVenue } from "@/lib/home-venue";
import {
	catalogWatchRegionToApiQuery,
	readCatalogMonochromePeersOnHoverPref,
	readCatalogTmdbWatchRegionPref,
} from "@/lib/profile-preferences";
import { serverApi } from "@/lib/server-api";
import {
	fetchMoviesDiscover,
	fetchMoviesNowPlaying,
	fetchMoviesUpcoming,
	fetchTvDiscover,
	fetchTvPopular,
} from "@/lib/still-api-fetch";
import { tmdbSetupHint } from "@/lib/tmdb-config";

export const dynamic = "force-dynamic";

/** First sheet from TMDb — client infinite scroll asks for page 2…N the same way as `/movies/popular`. */
const SEED_PAGE = 1;

/** “Latest” movie lobby rail — TMDb discover by primary release date (same vocabulary as `/movies/discover`). */
const LATEST_DISCOVER_SORT = "primary_release_date.desc" as const;

/** “Latest” TV lobby rail — TMDb discover TV by first air date (TV has no `primary_release_date`). */
const LATEST_TV_DISCOVER_SORT = "first_air_date.desc" as const;

type MovieSheetPayload = {
	page: number;
	total_pages?: number;
	total_results?: number;
	results?: { id: number; title: string; poster_url: string | null }[];
	code?: string;
	hint?: string;
};

export default async function HomePage({
	searchParams,
}: {
	searchParams: Promise<{ sort?: string; browse?: string; venue?: string }>;
}) {
	const sp = await searchParams;
	const browse = parseHomeBrowseSurface(sp.browse);
	const sort = parseHomeCatalogSort(sp.sort, browse);
	const movieVenue =
		browse === "movies" ? parseHomeVenue(sp.venue, sort) : null;
	const tvVenue = browse === "tv" ? parseHomeVenue(sp.venue, sort) : null;
	/** UTC `YYYY-MM-DD` — floors streaming-upcoming discover for movies (`release_gte`) and TV (`first_air_date.gte`). */
	const catalogReleaseFloorUtc = new Date().toISOString().slice(0, 10);
	/** Movies + at-home streaming for Latest/Popular (not Upcoming — that has its own discover window). */
	const movieLobbyStreamingCatalog =
		browse === "movies" &&
		movieVenue === "streaming" &&
		(sort === "popular" || sort === "latest");
	/** At home + Upcoming — subscription titles with primary release from today onward, soonest first. */
	const movieLobbyStreamingUpcoming =
		browse === "movies" && sort === "upcoming" && movieVenue === "streaming";
	/** In cinemas + Upcoming — TMDb discover: theatrical primary release **after** today (UTC) so the grid does not repeat Latest’s same-day openings. */
	const movieLobbyTheatersUpcoming =
		browse === "movies" && sort === "upcoming" && movieVenue === "theaters";
	const movieLobbyUsesNowPlaying =
		browse === "movies" && sort === "popular" && movieVenue === "theaters";
	/** In cinemas + Latest — already released theatrically in region (not TMDb `/upcoming`, which is future-only). */
	const movieLobbyTheatersLatestDiscover =
		browse === "movies" && sort === "latest" && movieVenue === "theaters";
	/** TV + Upcoming + at-home — first air dates from today on subscription services in `watch_region`. */
	const tvLobbyStreamingUpcoming =
		browse === "tv" && sort === "upcoming" && tvVenue === "streaming";
	/** TV + Upcoming + “broadcast” rail — first air dates from today without a subscription filter. */
	const tvLobbyTheatersUpcoming =
		browse === "tv" && sort === "upcoming" && tvVenue === "theaters";
	const communityFeed =
		browse === "community" ? parseHomeCommunityFeed(sp.sort) : null;
	const communityFeedMeta = HOME_COMMUNITY_FEEDS.find(
		(f) => f.id === communityFeed,
	);
	const communityFeedLabel = communityFeedMeta?.label ?? "Lists";
	const communityFeedHint =
		communityFeedMeta?.hint ??
		"Member lists, reviews, diary, and activity will appear here.";

	const jar = await cookies();
	/** Forward session cookies so RSC `fetch` hits the API as the signed-in user (mirrors other catalogue pages). */
	const cookieHeader = jar
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	const api = await serverApi();
	const [session, profileRes] = await Promise.all([
		authServer(),
		api.api.profiles.me.get().catch(() => ({ data: null })),
	]);

	const profileData = profileRes.data as {
		handle: string;
		displayName: string;
		preferences?: Record<string, unknown> | null;
	} | null;

	const mePrefs = profileData?.preferences ?? null;
	const catalogWatchPref = readCatalogTmdbWatchRegionPref(mePrefs);
	const streamingWatchRegionApi =
		catalogWatchRegionToApiQuery(catalogWatchPref);
	/** ISO alpha-2 for TMDb **theatrical** `region` (primary release dates) when the patron picked a country — mirrors streaming pref, excludes `ALL` / unset. */
	const patronCatalogTheatricalRegion =
		typeof catalogWatchPref === "string" && catalogWatchPref !== "ALL"
			? catalogWatchPref
			: undefined;

	const lobbyResult =
		browse === "community"
			? { data: null, error: null }
			: browse === "tv"
				? sort === "popular"
					? await fetchTvPopular(SEED_PAGE, { cookieHeader })
					: sort === "upcoming"
						? tvLobbyStreamingUpcoming
							? await fetchTvDiscover(SEED_PAGE, {
									cookieHeader,
									sortBy: "first_air_date.asc",
									airDateGte: catalogReleaseFloorUtc,
									monetization: "flatrate",
									watchRegion: streamingWatchRegionApi,
								})
							: await fetchTvDiscover(SEED_PAGE, {
									cookieHeader,
									sortBy: "first_air_date.asc",
									airDateGte: catalogReleaseFloorUtc,
								})
						: await fetchTvDiscover(SEED_PAGE, {
								cookieHeader,
								sortBy: LATEST_TV_DISCOVER_SORT,
							})
				: movieLobbyStreamingUpcoming
					? await fetchMoviesDiscover(SEED_PAGE, {
							cookieHeader,
							sortBy: "primary_release_date.asc",
							monetization: "flatrate",
							releaseGte: catalogReleaseFloorUtc,
							watchRegion: streamingWatchRegionApi,
						})
					: movieLobbyTheatersUpcoming
						? await fetchMoviesUpcoming(SEED_PAGE, {
								cookieHeader,
								region: patronCatalogTheatricalRegion,
							})
						: movieLobbyStreamingCatalog
							? await fetchMoviesDiscover(SEED_PAGE, {
									cookieHeader,
									sortBy:
										sort === "popular"
											? "popularity.desc"
											: LATEST_DISCOVER_SORT,
									// Same “watch at home” contract as Popular: subscription services + optional patron `watch_region`.
									monetization: "flatrate",
									watchRegion: streamingWatchRegionApi,
								})
							: movieLobbyUsesNowPlaying
								? await fetchMoviesNowPlaying(SEED_PAGE, { cookieHeader })
								: movieLobbyTheatersLatestDiscover
									? await fetchMoviesDiscover(SEED_PAGE, {
											cookieHeader,
											sortBy: LATEST_DISCOVER_SORT,
											venue: "theaters",
											region: patronCatalogTheatricalRegion,
										})
									: await fetchMoviesNowPlaying(SEED_PAGE, { cookieHeader });

	const { data, error } = lobbyResult;

	const monochromePeersOnHover = readCatalogMonochromePeersOnHoverPref(mePrefs);

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

	const payload = (data ?? null) as MovieSheetPayload | null;
	const seedMovies = payload?.results ?? [];
	const totalPages = payload?.total_pages ?? 0;
	const totalResults = payload?.total_results ?? 0;

	const unconfiguredHint = tmdbSetupHint(payload);
	const blockedReason =
		browse === "community"
			? null
			: error || unconfiguredHint
				? (unconfiguredHint ?? "Could not load titles for the lobby right now.")
				: null;

	const discoverSortForLobby =
		sort === "popular"
			? "popularity.desc"
			: browse === "tv"
				? sort === "upcoming"
					? "first_air_date.asc"
					: LATEST_TV_DISCOVER_SORT
				: sort === "upcoming" && movieVenue === "streaming"
					? "primary_release_date.asc"
					: LATEST_DISCOVER_SORT;

	const catalogKindForInfinite =
		browse === "tv"
			? sort === "popular"
				? "popular"
				: "discover"
			: movieLobbyTheatersUpcoming
				? "upcoming"
				: movieLobbyStreamingCatalog || movieLobbyStreamingUpcoming
					? "discover"
					: movieLobbyUsesNowPlaying
						? "now_playing"
						: "discover";

	/** Theatrical “newest in cinemas” discover uses `venue=theaters`; at-home streaming uses monetization only (`discoverVenue` null). */
	const discoverVenueForInfinite = movieLobbyTheatersLatestDiscover
		? "theaters"
		: null;

	const discoverMonetizationForInfinite =
		movieLobbyStreamingCatalog ||
		movieLobbyStreamingUpcoming ||
		tvLobbyStreamingUpcoming
			? "flatrate"
			: null;

	const discoverReleaseGteForInfinite = movieLobbyStreamingUpcoming
		? catalogReleaseFloorUtc
		: null;

	/** TV “upcoming” lobby uses TMDb `first_air_date.gte` via `/api/tv/discover`. */
	const discoverAirDateGteForInfinite =
		tvLobbyStreamingUpcoming || tvLobbyTheatersUpcoming
			? catalogReleaseFloorUtc
			: null;

	/** Patron `watch_region` / `ALL` for subscription streaming discover + infinite scroll. */
	const discoverWatchRegionForInfinite =
		movieLobbyStreamingCatalog ||
		movieLobbyStreamingUpcoming ||
		tvLobbyStreamingUpcoming
			? streamingWatchRegionApi
			: undefined;

	/** TMDb `region` on theatrical discover (`venue=theaters`) — must match seed fetch so infinite scroll pages the same territory. */
	const discoverReleaseRegionForInfinite = movieLobbyTheatersLatestDiscover
		? (patronCatalogTheatricalRegion ?? null)
		: null;

	/** Signed-in patrons who have not saved `catalogTmdbWatchRegion` yet — show `<dialog>` once. */
	const needsCatalogWatchRegionPrompt = Boolean(
		session && catalogWatchPref === null,
	);

	const catalogLabelForLobby =
		browse === "tv"
			? sort === "popular"
				? "popular"
				: sort === "upcoming"
					? tvVenue === "streaming"
						? "upcoming on subscription streaming"
						: "opening soon (first air dates ahead)"
					: "latest"
			: movieLobbyUsesNowPlaying
				? "now playing in theatres"
				: movieLobbyTheatersUpcoming
					? "opening soon in theatres"
					: movieLobbyTheatersLatestDiscover
						? "newest in cinemas"
						: movieLobbyStreamingUpcoming
							? "upcoming on subscription streaming"
							: movieLobbyStreamingCatalog
								? sort === "popular"
									? "popular on subscription streaming"
									: "newest on subscription streaming"
								: sort === "popular"
									? "popular"
									: "latest";

	return (
		// Fills `<main>` from `AppShell` (`flex-1 min-h-0` + bottom reserve) — do not use `min-h-svh` here or the card ignores shell padding above the nav inset.
		<div className="flex min-h-0 flex-1 flex-col overflow-visible bg-background">
			<HomeLobbySessionRestore />
			{/*
				Middle column `minmax(20rem, 56rem)` gives the search a real width band;
				`1fr auto 1fr` + `auto` alone shrink-wraps to input min-content so width
				never grew past the old `48rem` cap even when `max-w-*` increased.
			*/}
			<Suspense
				fallback={
					<div
						className="sticky top-0 z-20 h-14 w-full animate-pulse rounded-[2rem] bg-card/60"
						aria-hidden
					/>
				}
			>
				<HomeStickyChrome user={stickyUser} />
			</Suspense>

			<section
				className={cn(
					/* `flex-1` + `min-h-0` lets this card fill the viewport under the sticky chrome so community can center a true empty state. */
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					browse === "community" ? "overflow-hidden" : "overflow-visible",
				)}
			>
				{/*
						`useSearchParams` — keep inside Suspense so the home RSC shell can still
						stream; the bar is tiny so a short fallback is acceptable.
					*/}
				<div className="flex shrink-0 items-center justify-between gap-3">
					<Suspense
						fallback={
							<div
								className="h-10 w-44 animate-pulse rounded-full bg-background"
								aria-hidden
							/>
						}
					>
						<HomeCatalogSortChips />
					</Suspense>
					{browse !== "community" ? (
						<Suspense
							fallback={
								<div
									className="h-10 min-w-66 shrink-0 animate-pulse rounded-full bg-background"
									aria-hidden
								/>
							}
						>
							<HomeCatalogViewModeToolbar />
						</Suspense>
					) : null}
				</div>

				{browse === "community" ? (
					<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-6 sm:px-4 sm:py-10">
						{/*
							Dashed “plate” matches `/lists` empty rows — reads as intentional negative
							space, not a broken grid (Mobbin-style empty states on dark chrome).
						*/}
						<div
							className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border border-dashed bg-card/40 px-6 py-12 text-center sm:px-10 sm:py-14"
							role="status"
						>
							<div className="space-y-2">
								{/* `font-sans` = SF Pro Rounded stack (`--font-proxima-nova`) — not Fraunces display. */}
								<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
									{communityFeedLabel} — coming soon
								</p>
								<p className="text-muted-foreground text-sm leading-relaxed">
									{communityFeedHint} This lobby will fill in as we ship
									community surfaces. Until then, the TMDb catalogues are ready
									below the header.
								</p>
							</div>
							<div className="flex flex-wrap items-center justify-center gap-2">
								<Link
									href={buildHomeLobbyHref({
										browse: "movies",
										sort: "latest",
									})}
									className={buttonVariants({
										variant: "outline",
										size: "pill",
									})}
								>
									Browse movies
								</Link>
								<Link
									href={buildHomeLobbyHref({ browse: "tv", sort: "latest" })}
									className={buttonVariants({
										variant: "outline",
										size: "pill",
									})}
								>
									Browse TV
								</Link>
							</div>
						</div>
					</div>
				) : blockedReason ? (
					<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12">
						<p
							className="max-w-md text-center text-muted-foreground text-sm"
							role="status"
						>
							{blockedReason}
						</p>
					</div>
				) : (
					<>
						<PopularMoviesInfinite
							blockedReason={blockedReason}
							catalogKind={catalogKindForInfinite}
							catalogLabel={catalogLabelForLobby}
							catalogMedia={browse === "tv" ? "tv" : "movie"}
							discoverWatchRegion={discoverWatchRegionForInfinite}
							discoverAirDateGte={discoverAirDateGteForInfinite}
							discoverMonetization={discoverMonetizationForInfinite}
							discoverReleaseGte={discoverReleaseGteForInfinite}
							discoverReleaseRegion={discoverReleaseRegionForInfinite}
							discoverSortBy={discoverSortForLobby}
							discoverVenue={discoverVenueForInfinite}
							upcomingReleaseRegion={
								movieLobbyTheatersUpcoming
									? (patronCatalogTheatricalRegion ?? null)
									: null
							}
							gridClassName={HOME_LOBBY_CATALOGUE_GRID_CLASSNAME}
							posterFrameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
							posterHoverEffect="elevation"
							posterLinkClassName={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
							monochromePeersOnHover={monochromePeersOnHover}
							seedMovies={seedMovies}
							seedPage={SEED_PAGE}
							showTitle={false}
							staggerPosterEntrance
							totalPages={totalPages}
							totalResults={totalResults}
						/>
						{browse === "movies" &&
						(movieLobbyUsesNowPlaying ||
							movieLobbyTheatersLatestDiscover ||
							movieLobbyTheatersUpcoming) ? (
							<p className="mt-2 px-1 text-center text-muted-foreground text-xs leading-relaxed">
								In cinemas — from TMDb’s theatrical lists. Many titles also
								stream at home the same week; use Streaming for subscription
								availability in your region.
							</p>
						) : null}
						{browse === "movies" &&
						(movieLobbyStreamingCatalog || movieLobbyStreamingUpcoming) ? (
							<p className="mt-2 px-1 text-center text-muted-foreground text-xs leading-relaxed">
								At home — titles TMDb lists with subscription streaming in the
								catalogue region. You can set your streaming region (or all
								regions) in{" "}
								<Link
									href="/me/settings"
									className="underline underline-offset-2 hover:text-foreground"
								>
									Settings
								</Link>
								.
							</p>
						) : null}
						{browse === "tv" && tvLobbyStreamingUpcoming ? (
							<p className="mt-2 px-1 text-center text-muted-foreground text-xs leading-relaxed">
								At home — shows TMDb lists with subscription streaming in the
								catalogue region from today’s first-air dates onward. Set your
								streaming region (or all regions) in{" "}
								<Link
									href="/me/settings"
									className="underline underline-offset-2 hover:text-foreground"
								>
									Settings
								</Link>
								.
							</p>
						) : null}
					</>
				)}
			</section>
			{/* Native `<dialog>` — first-run streaming region; closes after `router.refresh()` saves prefs. */}
			{session ? (
				<CatalogWatchRegionPrompt open={needsCatalogWatchRegionPrompt} />
			) : null}
		</div>
	);
}
