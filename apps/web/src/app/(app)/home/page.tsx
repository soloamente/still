import { cn } from "@still/ui/lib/utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
	LobbyCatalogChipFallback,
	LobbyStickyChromeFallback,
	LobbyVenueChipFallback,
} from "@/components/app/lobby-suspense-fallbacks";
import { CatalogWatchRegionPrompt } from "@/components/home/catalog-watch-region-prompt";
import { CommunityLobbySkeleton } from "@/components/home/community-lobby-skeleton";
import { HomeCatalogSortChips } from "@/components/home/home-catalog-sort-chips";
import { HomeCatalogViewModeToolbar } from "@/components/home/home-catalog-view-mode-toolbar";
import { HomeCatalogueSearchInfinite } from "@/components/home/home-catalogue-search-infinite";
import { HomeCommunityPatronBody } from "@/components/home/home-community-patron-shell";
import { HomeCommunityRankKindToolbar } from "@/components/home/home-community-rank-kind-toolbar";
import { HomeCommunityRscPayload } from "@/components/home/home-community-rsc-payload";
import { HomeCommunityTrailingToolbar } from "@/components/home/home-community-trailing-toolbar";
import { HomeContinueWatchingRail } from "@/components/home/home-continue-watching-rail";
import { HomeLobbyBodyGate } from "@/components/home/home-lobby-body-gate";
import { HomeLobbyCatalogueSection } from "@/components/home/home-lobby-catalogue-section";
import { HomeLobbyFilterRow } from "@/components/home/home-lobby-filter-row";
import { HomeLobbyNavigationRoot } from "@/components/home/home-lobby-navigation-root";
import { HomeLobbySessionRestore } from "@/components/home/home-lobby-session-restore";
import { HomeStickyChrome } from "@/components/home/home-sticky-chrome";
import { HomeTasteMatchedHeroRsc } from "@/components/home/home-taste-matched-hero-rsc";
import { HomeTasteMatchedHeroSkeleton } from "@/components/home/home-taste-matched-hero-skeleton";
import {
	HomeTmdbCatalogueGrid,
	HomeTmdbLobbyChrome,
} from "@/components/home/home-tmdb-lobby-chrome";
import { TmdbLobbySkeleton } from "@/components/home/tmdb-lobby-skeleton";
import { PopularMoviesInfinite } from "@/components/movie/popular-movies-infinite";
import { APP_NAME } from "@/lib/app-brand";
import { authServer } from "@/lib/auth-server";
import { fetchMeProfile, PROFILE_FETCH_FAILED } from "@/lib/fetch-me-profile";
import { fetchTvWatchMeServer } from "@/lib/fetch-tv-watch-me-server";
import {
	animeSeasonTvDiscoverParams,
	parseHomeAnimeSeason,
} from "@/lib/home-anime-season";
import { parseHomeBrowseSurface } from "@/lib/home-browse-surface";
import { parseHomeCatalogFilters } from "@/lib/home-catalog-filters";
import {
	effectiveHomeCatalogRun,
	parseHomeCatalogRun,
	TV_COMPLETED_DISCOVER_STATUS,
	TV_ONGOING_DISCOVER_STATUS,
	TV_UPCOMING_DISCOVER_SORT,
	tvDiscoverSortByForLobbySort,
} from "@/lib/home-catalog-run";
import { parseHomeCatalogSort } from "@/lib/home-catalog-sort";
import { loadCommittedCatalogueSearchSeeds } from "@/lib/home-catalogue-search-load-page";
import {
	isHomeCatalogueSearchActive,
	parseHomeCatalogueSearchLobbySort,
} from "@/lib/home-catalogue-search-param";
import {
	parseHomeCommunityFeed,
	parseHomeCommunityRankKind,
} from "@/lib/home-community-feed";
import { parseHomeCommunityPeriod } from "@/lib/home-leaderboard-period";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
	HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import {
	HOME_LOBBY_HREF_COOKIE,
	isBareHomeLobbySearchParams,
	parseHomeLobbyHrefCookie,
} from "@/lib/home-lobby-cookie";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import { parseHomeVenue, parseTvLobbyVenue } from "@/lib/home-venue";
import {
	OG_HOME_PATH,
	ogImageMetadataFields,
} from "@/lib/og/og-image-metadata";
import { buildPatronNavUserOrNull } from "@/lib/patron-nav-user";
import {
	catalogWatchRegionToApiQuery,
	readCatalogMonochromePeersOnHoverPref,
	readCatalogTmdbWatchRegionPref,
	resolveCatalogTmdbLanguage,
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

export const metadata: Metadata = {
	...ogImageMetadataFields(OG_HOME_PATH),
};

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

type HomeSearchParams = {
	sort?: string;
	browse?: string;
	venue?: string;
	run?: string;
	animeSeason?: string;
	period?: string;
	/** Films vs TV vs patron contribution when `sort=ranks`. */
	rank?: string;
	/** Legacy — maps to `?rank=` on Ranks. */
	memberSort?: string;
	search?: string;
	genre?: string;
	monetization?: string;
};

/**
 * Pure, synchronous derivation of every lobby parameter from the (already
 * cookie-restored) search params. Extracted so the page shell can render and
 * flush immediately while the data-fetching body streams in behind a Suspense
 * boundary — none of this touches the network.
 */
function deriveHomeLobbyParams(sp: HomeSearchParams, spRaw: HomeSearchParams) {
	const browse = parseHomeBrowseSurface(sp.browse);
	/** Committed ⌘K search — URL is source of truth; use raw params (not cookie restore). */
	const committedSearchParams = new URLSearchParams();
	const committedSearchRaw = spRaw.search?.trim();
	if (committedSearchRaw) {
		committedSearchParams.set("search", committedSearchRaw);
	}
	const catalogueBrowseSurface =
		browse === "tv" ? "tv" : browse === "community" ? "community" : "movies";
	const catalogueSearchActive = isHomeCatalogueSearchActive(
		committedSearchParams,
		catalogueBrowseSurface,
	);
	const searchLobbyParams = new URLSearchParams();
	if (committedSearchRaw) {
		searchLobbyParams.set("search", committedSearchRaw);
	}
	if (sp.sort) {
		searchLobbyParams.set("sort", sp.sort);
	}
	if (sp.browse) {
		searchLobbyParams.set("browse", sp.browse);
	}
	const catalogueSearchSort = catalogueSearchActive
		? parseHomeCatalogueSearchLobbySort(
				searchLobbyParams,
				browse === "tv" ? "tv" : "movies",
			)
		: null;
	/** Retired community **Diary** tab — same feed as **Activity**; canonicalize old links. */
	const communityDiarySort = (sp.sort ?? "").trim().toLowerCase();
	/** Legacy TV `?sort=ongoing|upcoming` → matching `?run=` + Popular. */
	const sortRaw = sp.sort?.trim().toLowerCase() ?? "";
	const catalogRunRaw =
		parseHomeCatalogRun(sp.run, browse) ??
		(browse === "tv" &&
		(sortRaw === "ongoing" ||
			sortRaw === "on-air" ||
			sortRaw === "on_the_air" ||
			sortRaw === "upcoming" ||
			sortRaw === "coming" ||
			sortRaw === "soon")
			? sortRaw === "upcoming" || sortRaw === "coming" || sortRaw === "soon"
				? "upcoming"
				: "ongoing"
			: null);
	const animeSeasonActive =
		browse === "tv" &&
		parseHomeAnimeSeason(sp.animeSeason) &&
		catalogRunRaw == null;
	const catalogRun = effectiveHomeCatalogRun({
		run: catalogRunRaw,
		browse,
		animeSeason: animeSeasonActive,
	});
	const sort = parseHomeCatalogSort(sp.sort, browse);
	const communityFeed = parseHomeCommunityFeed(sp.sort);
	const communityPeriod = parseHomeCommunityPeriod(sp.period);
	const communityRankKind = parseHomeCommunityRankKind(
		sp.rank,
		sp.sort,
		spRaw.memberSort,
	);
	/** Retired patron rank slices — map bookmarked URLs to Reviews. */
	const retiredPatronRank = sp.rank?.trim().toLowerCase();
	const movieVenue =
		browse === "movies" ? parseHomeVenue(sp.venue, sort) : null;
	const tvVenue =
		browse === "tv" ? parseTvLobbyVenue(sp.venue, sort, catalogRun) : null;
	const catalogFilterParams = new URLSearchParams();
	if (sp.genre) catalogFilterParams.set("genre", sp.genre);
	if (sp.monetization) {
		catalogFilterParams.set("monetization", sp.monetization);
	}
	const catalogFilters =
		browse === "movies" && movieVenue
			? parseHomeCatalogFilters(catalogFilterParams, {
					venue: movieVenue,
					sort,
				})
			: browse === "tv" && tvVenue
				? parseHomeCatalogFilters(catalogFilterParams, {
						venue: tvVenue,
						sort,
					})
				: { genreId: null, monetization: null };
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
	const movieLobbyUsesNowPlayingWithGenre =
		movieLobbyUsesNowPlaying && catalogFilters.genreId != null;
	/** In cinemas + Latest — already released theatrically in region (not TMDb `/upcoming`, which is future-only). */
	const movieLobbyTheatersLatestDiscover =
		browse === "movies" && sort === "latest" && movieVenue === "theaters";
	/** TV **Upcoming** run + at-home — first air dates from today on subscription services. */
	const tvLobbyStreamingUpcoming =
		browse === "tv" && catalogRun === "upcoming" && tvVenue === "streaming";
	/** TV **Upcoming** run + In cinemas — first air dates from today (all networks). */
	const tvLobbyTheatersUpcoming =
		browse === "tv" && catalogRun === "upcoming" && tvVenue === "theaters";

	return {
		browse,
		committedSearchRaw,
		catalogueSearchActive,
		catalogueSearchSort,
		communityDiarySort,
		catalogRun,
		animeSeasonActive,
		sort,
		communityFeed,
		communityPeriod,
		communityRankKind,
		retiredPatronRank,
		movieVenue,
		tvVenue,
		catalogFilters,
		catalogReleaseFloorUtc,
		movieLobbyStreamingCatalog,
		movieLobbyStreamingUpcoming,
		movieLobbyTheatersUpcoming,
		movieLobbyUsesNowPlaying,
		movieLobbyUsesNowPlayingWithGenre,
		movieLobbyTheatersLatestDiscover,
		tvLobbyStreamingUpcoming,
		tvLobbyTheatersUpcoming,
	};
}

type HomeLobbyParams = ReturnType<typeof deriveHomeLobbyParams>;

/** Shell-matching placeholder shown while {@link HomeLobbyBody} streams in. */
function HomeLobbyShellFallback({
	browse,
}: {
	browse: HomeLobbyParams["browse"];
}) {
	return (
		<>
			<LobbyStickyChromeFallback />
			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"overflow-visible",
				)}
			>
				{browse === "community" ? (
					<CommunityLobbySkeleton />
				) : (
					<TmdbLobbySkeleton />
				)}
			</section>
		</>
	);
}

export default async function HomePage({
	searchParams,
}: {
	searchParams: Promise<HomeSearchParams>;
}) {
	const spRaw = await searchParams;
	const jar = await cookies();
	/** Bare `/home` — restore chips from cookie so we do not `redirect()` (307) on every visit. */
	const sp = isBareHomeLobbySearchParams(spRaw)
		? (parseHomeLobbyHrefCookie(jar.get(HOME_LOBBY_HREF_COOKIE)?.value) ??
			spRaw)
		: spRaw;

	const params = deriveHomeLobbyParams(sp, spRaw);
	const {
		browse,
		communityDiarySort,
		communityFeed,
		communityPeriod,
		communityRankKind,
		retiredPatronRank,
	} = params;

	// Legacy URL canonicalization — run before render so these stay clean 307s
	// (a redirect mid-stream cannot set the response status cleanly).
	/** Retired community **Diary** tab — same feed as **Activity**; canonicalize old links. */
	if (
		browse === "community" &&
		(communityDiarySort === "diary" ||
			communityDiarySort === "diaries" ||
			communityDiarySort === "logs" ||
			communityDiarySort === "log")
	) {
		redirect(buildHomeLobbyHref({ browse: "community", sort: "activity" }));
	}
	/** Canonicalize legacy `?sort=members` → Ranks + `?rank=`. */
	if (
		browse === "community" &&
		(communityDiarySort === "members" || communityDiarySort === "member")
	) {
		redirect(
			buildHomeLobbyHref({
				browse: "community",
				sort: "ranks",
				rankKind: communityRankKind,
				period: communityPeriod,
			}),
		);
	}
	/** Retired patron rank slices — map bookmarked URLs to Reviews. */
	if (
		browse === "community" &&
		communityFeed === "ranks" &&
		(retiredPatronRank === "popular" ||
			retiredPatronRank === "lists" ||
			retiredPatronRank === "list" ||
			retiredPatronRank === "likes" ||
			retiredPatronRank === "like")
	) {
		redirect(
			buildHomeLobbyHref({
				browse: "community",
				sort: "ranks",
				rankKind: "reviews",
				period: communityPeriod,
			}),
		);
	}

	return (
		// Fills `<main>` from `AppShell` (`flex-1 min-h-0` + bottom reserve) — do not use `min-h-svh` here or the card ignores shell padding above the nav inset.
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<HomeLobbyNavigationRoot>
				<HomeLobbySessionRestore />
				{/*
					Data-heavy body streams behind Suspense so the shell + skeleton
					flush on the first byte instead of blocking on the auth, profile,
					and catalogue round-trips (remote DB ⇒ this matters a lot).
				*/}
				<Suspense fallback={<HomeLobbyShellFallback browse={browse} />}>
					<HomeLobbyBody params={params} />
				</Suspense>
			</HomeLobbyNavigationRoot>
		</div>
	);
}

async function HomeLobbyBody({ params }: { params: HomeLobbyParams }) {
	const {
		browse,
		committedSearchRaw,
		catalogueSearchActive,
		catalogueSearchSort,
		catalogRun,
		animeSeasonActive,
		sort,
		communityFeed,
		communityPeriod,
		communityRankKind,
		movieVenue,
		tvVenue,
		catalogFilters,
		catalogReleaseFloorUtc,
		movieLobbyStreamingCatalog,
		movieLobbyStreamingUpcoming,
		movieLobbyTheatersUpcoming,
		movieLobbyUsesNowPlaying,
		movieLobbyUsesNowPlayingWithGenre,
		movieLobbyTheatersLatestDiscover,
		tvLobbyStreamingUpcoming,
		tvLobbyTheatersUpcoming,
	} = params;

	/** Forward session cookies so RSC `fetch` hits the API as the signed-in user (mirrors other catalogue pages). */
	const jar = await cookies();
	const cookieHeader = jar
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");

	const api = await serverApi();
	const [session, profileResult] = await Promise.all([
		authServer(),
		fetchMeProfile(),
	]);
	const profileDataEarly =
		profileResult === PROFILE_FETCH_FAILED ? null : profileResult;
	const catalogLanguage = resolveCatalogTmdbLanguage(
		profileDataEarly?.preferences ?? null,
	);

	const profileData =
		profileResult === PROFILE_FETCH_FAILED ? null : profileResult;
	const mePrefs = profileData?.preferences ?? null;

	const catalogWatchPref = readCatalogTmdbWatchRegionPref(mePrefs);
	const streamingWatchRegionApi =
		catalogWatchRegionToApiQuery(catalogWatchPref);
	/** ISO alpha-2 for TMDb **theatrical** `region` (primary release dates) when the patron picked a country — mirrors streaming pref, excludes `ALL` / unset. */
	const patronCatalogTheatricalRegion =
		typeof catalogWatchPref === "string" && catalogWatchPref !== "ALL"
			? catalogWatchPref
			: undefined;

	/** TV left-rail sort is only Popular or Latest (Upcoming lives on `?run=`). */
	const tvLobbySort = sort === "popular" ? "popular" : "latest";

	const movieFilterGenreId = catalogFilters.genreId ?? undefined;
	const movieFilterMonetization = catalogFilters.monetization ?? "flatrate";
	const tvFilterGenreId = catalogFilters.genreId ?? undefined;
	const tvFilterMonetization = catalogFilters.monetization ?? "flatrate";
	const tvPopularNeedsDiscover =
		browse === "tv" &&
		!animeSeasonActive &&
		catalogRun === "ongoing" &&
		sort === "popular" &&
		(tvFilterGenreId != null ||
			(tvVenue === "streaming" && tvFilterMonetization !== "flatrate"));

	const [continueWatching, committedSearchPayload, lobbyResult] =
		await Promise.all([
			// Personal TV progress rail — skip while committed search replaces the grid.
			session && browse === "tv" && !catalogueSearchActive
				? fetchTvWatchMeServer(api, {
						status: "watching,rewatching",
						limit: 12,
					})
				: Promise.resolve([]),
			catalogueSearchActive && committedSearchRaw
				? loadCommittedCatalogueSearchSeeds({
						searchRaw: committedSearchRaw,
						browse: browse === "tv" ? "tv" : "movies",
						sort: catalogueSearchSort ?? "popular",
						cookieHeader,
						catalogLanguage,
					})
				: Promise.resolve(null),
			// Lobby catalogue fetch — runs concurrently with the personal rails above.
			(async (): Promise<{
				data: unknown;
				error: { status: number; nonJson?: boolean } | null;
			}> => {
				if (catalogueSearchActive) return { data: null, error: null };
				try {
					return browse === "community"
						? { data: null, error: null }
						: browse === "tv"
							? animeSeasonActive
								? await fetchTvDiscover(SEED_PAGE, {
										cookieHeader,
										...animeSeasonTvDiscoverParams(tvLobbySort),
									})
								: catalogRun === "ongoing"
									? await fetchTvDiscover(SEED_PAGE, {
											cookieHeader,
											sortBy: tvDiscoverSortByForLobbySort(tvLobbySort),
											status: TV_ONGOING_DISCOVER_STATUS,
											genreId: tvFilterGenreId,
										})
									: catalogRun === "completed"
										? await fetchTvDiscover(SEED_PAGE, {
												cookieHeader,
												sortBy: tvDiscoverSortByForLobbySort(tvLobbySort),
												status: TV_COMPLETED_DISCOVER_STATUS,
												genreId: tvFilterGenreId,
											})
										: catalogRun === "upcoming"
											? tvLobbyStreamingUpcoming
												? await fetchTvDiscover(SEED_PAGE, {
														cookieHeader,
														sortBy: TV_UPCOMING_DISCOVER_SORT,
														airDateGte: catalogReleaseFloorUtc,
														monetization: tvFilterMonetization,
														watchRegion: streamingWatchRegionApi,
														genreId: tvFilterGenreId,
													})
												: await fetchTvDiscover(SEED_PAGE, {
														cookieHeader,
														sortBy: TV_UPCOMING_DISCOVER_SORT,
														airDateGte: catalogReleaseFloorUtc,
														genreId: tvFilterGenreId,
													})
											: tvPopularNeedsDiscover
												? await fetchTvDiscover(SEED_PAGE, {
														cookieHeader,
														sortBy: "popularity.desc",
														genreId: tvFilterGenreId,
														monetization:
															tvVenue === "streaming"
																? tvFilterMonetization
																: undefined,
														watchRegion:
															tvVenue === "streaming"
																? streamingWatchRegionApi
																: undefined,
													})
												: sort === "popular"
													? await fetchTvPopular(SEED_PAGE, { cookieHeader })
													: await fetchTvDiscover(SEED_PAGE, {
															cookieHeader,
															sortBy: LATEST_TV_DISCOVER_SORT,
															genreId: tvFilterGenreId,
														})
							: movieLobbyStreamingUpcoming
								? await fetchMoviesDiscover(SEED_PAGE, {
										cookieHeader,
										sortBy: "primary_release_date.asc",
										venue: "streaming",
										monetization: movieFilterMonetization,
										releaseGte: catalogReleaseFloorUtc,
										watchRegion: streamingWatchRegionApi,
										genreId: movieFilterGenreId,
									})
								: movieLobbyTheatersUpcoming
									? movieFilterGenreId
										? await fetchMoviesDiscover(SEED_PAGE, {
												cookieHeader,
												sortBy: "primary_release_date.asc",
												venue: "theaters",
												region: patronCatalogTheatricalRegion,
												genreId: movieFilterGenreId,
											})
										: await fetchMoviesUpcoming(SEED_PAGE, {
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
												venue: "streaming",
												monetization: movieFilterMonetization,
												watchRegion: streamingWatchRegionApi,
												genreId: movieFilterGenreId,
											})
										: movieLobbyUsesNowPlayingWithGenre
											? await fetchMoviesDiscover(SEED_PAGE, {
													cookieHeader,
													sortBy: "popularity.desc",
													venue: "theaters",
													region: patronCatalogTheatricalRegion,
													genreId: movieFilterGenreId,
												})
											: movieLobbyUsesNowPlaying
												? await fetchMoviesNowPlaying(SEED_PAGE, {
														cookieHeader,
													})
												: movieLobbyTheatersLatestDiscover
													? await fetchMoviesDiscover(SEED_PAGE, {
															cookieHeader,
															sortBy: LATEST_DISCOVER_SORT,
															venue: "theaters",
															region: patronCatalogTheatricalRegion,
															genreId: movieFilterGenreId,
														})
													: sort === "latest"
														? await fetchMoviesDiscover(SEED_PAGE, {
																cookieHeader,
																sortBy: LATEST_DISCOVER_SORT,
																venue:
																	movieVenue === "streaming"
																		? "streaming"
																		: "theaters",
																monetization:
																	movieVenue === "streaming"
																		? movieFilterMonetization
																		: undefined,
																watchRegion:
																	movieVenue === "streaming"
																		? streamingWatchRegionApi
																		: undefined,
																region:
																	movieVenue === "theaters"
																		? patronCatalogTheatricalRegion
																		: undefined,
																genreId: movieFilterGenreId,
															})
														: await fetchMoviesNowPlaying(SEED_PAGE, {
																cookieHeader,
															});
				} catch (err) {
					console.error("[home] catalogue fetch failed", err);
					return { data: null, error: { status: 0 } };
				}
			})(),
		]);

	const { data, error } = lobbyResult;

	const monochromePeersOnHover = readCatalogMonochromePeersOnHoverPref(mePrefs);

	const stickyUser = buildPatronNavUserOrNull(session, profileData);

	const payload = (data ?? null) as MovieSheetPayload | null;
	const seedMovies = payload?.results ?? [];
	const totalPages = payload?.total_pages ?? 0;
	const totalResults = payload?.total_results ?? 0;

	const unconfiguredHint = tmdbSetupHint(payload);
	const blockedReason =
		browse === "community"
			? null
			: unconfiguredHint
				? unconfiguredHint
				: error?.status === 0
					? `Can't reach ${APP_NAME} right now. Make sure the API is running, then refresh.`
					: error?.nonJson
						? `${APP_NAME}'s catalogue API returned an unexpected response. Check the database connection, then refresh.`
						: error
							? "Could not load titles for the lobby right now."
							: null;

	const discoverSortForLobby =
		sort === "popular"
			? "popularity.desc"
			: browse === "tv"
				? animeSeasonActive
					? tvDiscoverSortByForLobbySort(tvLobbySort)
					: catalogRun === "upcoming"
						? TV_UPCOMING_DISCOVER_SORT
						: tvDiscoverSortByForLobbySort(tvLobbySort)
				: sort === "upcoming" && movieVenue === "streaming"
					? "primary_release_date.asc"
					: LATEST_DISCOVER_SORT;

	const catalogKindForInfinite =
		browse === "tv"
			? animeSeasonActive ||
				catalogRun === "ongoing" ||
				catalogRun === "completed" ||
				catalogRun === "upcoming" ||
				sort !== "popular" ||
				tvPopularNeedsDiscover
				? "discover"
				: "popular"
			: movieLobbyTheatersUpcoming
				? "upcoming"
				: movieLobbyStreamingCatalog || movieLobbyStreamingUpcoming
					? "discover"
					: movieLobbyUsesNowPlaying && !movieLobbyUsesNowPlayingWithGenre
						? "now_playing"
						: "discover";

	/** Theatrical discover uses `venue=theaters`; at-home pairs `venue=streaming` (digital release type) with monetization. */
	const discoverVenueForInfinite = movieLobbyTheatersLatestDiscover
		? "theaters"
		: movieLobbyStreamingCatalog || movieLobbyStreamingUpcoming
			? "streaming"
			: null;

	const discoverMonetizationForInfinite =
		movieLobbyStreamingCatalog ||
		movieLobbyStreamingUpcoming ||
		tvLobbyStreamingUpcoming
			? (catalogFilters.monetization ?? "flatrate")
			: browse === "tv" &&
					!animeSeasonActive &&
					catalogRun === "ongoing" &&
					sort === "popular" &&
					tvVenue === "streaming" &&
					tvPopularNeedsDiscover
				? (catalogFilters.monetization ?? "flatrate")
				: null;

	const discoverReleaseGteForInfinite = movieLobbyStreamingUpcoming
		? catalogReleaseFloorUtc
		: null;

	/** TV “upcoming” lobby uses TMDb `first_air_date.gte` via `/api/tv/discover`. */
	const discoverAirDateGteForInfinite = animeSeasonActive
		? animeSeasonTvDiscoverParams(tvLobbySort).airDateGte
		: tvLobbyStreamingUpcoming || tvLobbyTheatersUpcoming
			? catalogReleaseFloorUtc
			: null;

	const discoverGenreIdForInfinite = animeSeasonActive
		? animeSeasonTvDiscoverParams(tvLobbySort).genreId
		: (catalogFilters.genreId ?? null);

	const discoverTvStatusForInfinite =
		browse === "tv" && animeSeasonActive
			? TV_ONGOING_DISCOVER_STATUS
			: browse === "tv" && catalogRun === "completed"
				? TV_COMPLETED_DISCOVER_STATUS
				: browse === "tv" && catalogRun === "ongoing"
					? TV_ONGOING_DISCOVER_STATUS
					: null;

	/** Patron `watch_region` / `ALL` for subscription streaming discover + infinite scroll. */
	const discoverWatchRegionForInfinite =
		movieLobbyStreamingCatalog ||
		movieLobbyStreamingUpcoming ||
		tvLobbyStreamingUpcoming ||
		(browse === "tv" && tvPopularNeedsDiscover && tvVenue === "streaming")
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

	/** Remount infinite grid when lobby slice changes — avoids one frame of stale rows + double entrance. */
	const lobbyCatalogueResetKey = [
		browse,
		sort,
		catalogRun ?? "",
		animeSeasonActive ? "animeSeason" : "",
		movieVenue ?? tvVenue ?? "",
		discoverSortForLobby,
		catalogKindForInfinite,
		catalogFilters.genreId ?? "",
		catalogFilters.monetization ?? "",
	].join("|");

	const catalogLabelForLobby =
		browse === "tv"
			? animeSeasonActive
				? "airing anime this season"
				: catalogRun === "ongoing"
					? "returning series"
					: catalogRun === "completed"
						? "completed series"
						: catalogRun === "upcoming"
							? tvVenue === "streaming"
								? "upcoming on subscription streaming"
								: "opening soon (first air dates ahead)"
							: sort === "popular"
								? "popular"
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
		<>
			{/*
				Middle column `minmax(20rem, 56rem)` gives the search a real width band;
				`1fr auto 1fr` + `auto` alone shrink-wraps to input min-content so width
				never grew past the old `48rem` cap even when `max-w-*` increased.
			*/}
			<Suspense fallback={<LobbyStickyChromeFallback />}>
				<HomeStickyChrome user={stickyUser} />
			</Suspense>

			<HomeLobbyCatalogueSection>
				{/*
					`useSearchParams` — keep inside Suspense so the home RSC shell can still
					stream; the bar is tiny so a short fallback is acceptable.
				*/}
				<HomeLobbyBodyGate serverBrowse={browse}>
					{browse === "community" ? (
						<Suspense fallback={<CommunityLobbySkeleton />}>
							<HomeCommunityRscPayload
								feed={communityFeed}
								period={communityPeriod}
								rankKind={communityRankKind}
							>
								<HomeLobbyFilterRow
									leadingScrollKey={`community-${communityFeed}-${communityRankKind}`}
									leading={
										<Suspense fallback={<LobbyCatalogChipFallback />}>
											<HomeCatalogSortChips catalogBrowse="community" />
										</Suspense>
									}
									center={
										communityFeed === "ranks" ? (
											<Suspense fallback={null}>
												<HomeCommunityRankKindToolbar />
											</Suspense>
										) : undefined
									}
									trailing={
										<Suspense fallback={<LobbyVenueChipFallback />}>
											<HomeCommunityTrailingToolbar />
										</Suspense>
									}
								/>
								<HomeCommunityPatronBody
									monochromePeersOnHover={monochromePeersOnHover}
									signedIn={Boolean(session)}
									viewerUserId={session?.user?.id ?? null}
								/>
							</HomeCommunityRscPayload>
						</Suspense>
					) : (
						<HomeTmdbLobbyChrome>
							{!catalogueSearchActive && session && browse === "movies" ? (
								<Suspense fallback={<HomeTasteMatchedHeroSkeleton />}>
									<HomeTasteMatchedHeroRsc />
								</Suspense>
							) : null}

							<HomeLobbyFilterRow
								leadingScrollKey={`${browse}-${sort}-${catalogRun ?? ""}`}
								leading={
									<Suspense fallback={<LobbyCatalogChipFallback />}>
										<HomeCatalogSortChips catalogBrowse={browse} />
									</Suspense>
								}
								trailing={
									<Suspense fallback={<LobbyVenueChipFallback />}>
										<HomeCatalogViewModeToolbar />
									</Suspense>
								}
							/>

							{!catalogueSearchActive &&
							session &&
							browse === "tv" &&
							continueWatching.length > 0 ? (
								<HomeContinueWatchingRail items={continueWatching} />
							) : null}

							{catalogueSearchActive && committedSearchRaw ? (
								<HomeCatalogueSearchInfinite
									browse={browse === "tv" ? "tv" : "movies"}
									signedIn={Boolean(session)}
									monochromePeersOnHover={monochromePeersOnHover}
									searchRaw={committedSearchRaw}
									searchSort={catalogueSearchSort ?? "popular"}
									searchWaveKey={
										committedSearchPayload?.searchWaveKey ??
										`${browse}:${catalogueSearchSort ?? "popular"}:${committedSearchRaw}`
									}
									seedMovies={committedSearchPayload?.seeds ?? []}
									totalPages={committedSearchPayload?.totalPages ?? 0}
									initialError={committedSearchPayload?.error ?? false}
								/>
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
								<HomeTmdbCatalogueGrid>
									<PopularMoviesInfinite
										key={lobbyCatalogueResetKey}
										catalogueRadialSurface="home"
										signedIn={Boolean(session)}
										blockedReason={blockedReason}
										catalogKind={catalogKindForInfinite}
										catalogLabel={catalogLabelForLobby}
										catalogMedia={browse === "tv" ? "tv" : "movie"}
										discoverWatchRegion={discoverWatchRegionForInfinite}
										discoverAirDateGte={discoverAirDateGteForInfinite}
										discoverGenreId={discoverGenreIdForInfinite}
										discoverMonetization={discoverMonetizationForInfinite}
										discoverReleaseGte={discoverReleaseGteForInfinite}
										discoverReleaseRegion={discoverReleaseRegionForInfinite}
										discoverSortBy={discoverSortForLobby}
										discoverTvStatus={discoverTvStatusForInfinite}
										discoverVenue={discoverVenueForInfinite}
										upcomingReleaseRegion={
											movieLobbyTheatersUpcoming
												? (patronCatalogTheatricalRegion ?? null)
												: null
										}
										gridClassName={HOME_LOBBY_CATALOGUE_GRID_CLASSNAME}
										posterFrameClassName={
											HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME
										}
										posterHoverEffect="elevation"
										posterLinkClassName={
											HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME
										}
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
											In cinemas — from TMDb’s theatrical lists. Many titles
											also stream at home the same week; use Streaming for
											subscription availability in your region.
										</p>
									) : null}
									{browse === "movies" &&
									(movieLobbyStreamingCatalog ||
										movieLobbyStreamingUpcoming) ? (
										<p className="mt-2 px-1 text-center text-muted-foreground text-xs leading-relaxed">
											At home — titles TMDb lists with subscription streaming in
											the catalogue region. You can set your streaming region
											(or all regions) in{" "}
											<Link
												href="/me/settings"
												className="underline underline-offset-2 hover:text-foreground"
											>
												Settings
											</Link>
											.
										</p>
									) : null}
									{browse === "tv" &&
									catalogRun === "upcoming" &&
									tvLobbyStreamingUpcoming ? (
										<p className="mt-2 px-1 text-center text-muted-foreground text-xs leading-relaxed">
											At home — shows TMDb lists with subscription streaming in
											the catalogue region from today’s first-air dates onward.
											Set your streaming region (or all regions) in{" "}
											<Link
												href="/me/settings"
												className="underline underline-offset-2 hover:text-foreground"
											>
												Settings
											</Link>
											.
										</p>
									) : null}
									{browse === "tv" && catalogRun === "ongoing" ? (
										<p className="mt-2 px-1 text-center text-muted-foreground text-xs leading-relaxed">
											Ongoing — TMDb Returning Series (still in production or
											awaiting new episodes). Ended shows sit under Completed
											only. Open{" "}
											<Link
												href={buildHomeLobbyHref({
													browse: "tv",
													sort: "popular",
													run: "ongoing",
												})}
												className="underline underline-offset-2 hover:text-foreground"
											>
												the full returning catalogue
											</Link>{" "}
											to scroll beyond this grid.
										</p>
									) : null}
								</HomeTmdbCatalogueGrid>
							)}
						</HomeTmdbLobbyChrome>
					)}
				</HomeLobbyBodyGate>
			</HomeLobbyCatalogueSection>
			{/* First-run streaming region modal; closes client-side after prefs save. */}
			{session ? (
				<CatalogWatchRegionPrompt open={needsCatalogWatchRegionPrompt} />
			) : null}
		</>
	);
}
