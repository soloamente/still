"use client";

import IconSlider from "@still/ui/icons/slider";
import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { HomeCatalogFiltersPopover } from "@/components/home/home-catalog-filters-popover";
import { useHomeTmdbLobbyParamsOptional } from "@/components/home/home-tmdb-lobby-params-context";
import { useLobbyNavigation } from "@/components/lobby/lobby-navigation-provider";

import {
	buildDiaryLobbyHref,
	type DiaryLobbyOrder,
	parseDiaryLedgerTab,
	parseDiaryLobbyOrder,
	parseDiaryLobbyVenue,
} from "@/lib/diary-lobby-order";
import { discoverCatalogUrl } from "@/lib/discover-catalog-url";
import { parseHomeAnimeSeason } from "@/lib/home-anime-season";
import { parseHomeBrowseSurface } from "@/lib/home-browse-surface";
import {
	hasActiveHomeCatalogFilters,
	parseHomeCatalogFilters,
} from "@/lib/home-catalog-filters";
import {
	DEFAULT_HOME_CATALOG_RUN,
	effectiveHomeCatalogRun,
	type HomeCatalogRun,
	parseHomeCatalogRun,
	TV_COMPLETED_DISCOVER_STATUS,
	TV_ONGOING_DISCOVER_STATUS,
	TV_UPCOMING_DISCOVER_SORT,
	tvDiscoverSortByForLobbySort,
} from "@/lib/home-catalog-run";
import { parseHomeCatalogSort } from "@/lib/home-catalog-sort";
import {
	buildHomeCatalogueSearchClearHref,
	isHomeCatalogueSearchActive,
} from "@/lib/home-catalogue-search-param";
import { readHomeLobbyPersisted } from "@/lib/home-lobby-persist";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import {
	parseExplicitHomeVenue,
	parseHomeVenue,
	parseTvLobbyVenue,
} from "@/lib/home-venue";
import { tvDiscoverCatalogUrl } from "@/lib/tv-discover-catalog-url";

const filtersTriggerClass = cn(
	"relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-[transform,color] duration-200 ease-out active:scale-[0.96] motion-reduce:transition-none",
	"[@media(hover:hover)]:hover:bg-card/55 [@media(hover:hover)]:hover:text-foreground",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

function CatalogueFiltersControl({
	usePopover,
	browse,
	filtersHref,
	filtersAria,
	venue,
	filters,
	summaryLabel,
	currentHref,
	onNavigate,
	onPrefetch,
	hideGenreFilter = false,
}: {
	usePopover: boolean;
	browse: "movies" | "tv";
	filtersHref: string;
	filtersAria: string;
	venue: "theaters" | "streaming";
	filters: ReturnType<typeof parseHomeCatalogFilters>;
	summaryLabel: string;
	currentHref: string;
	onNavigate: (href: string) => void;
	onPrefetch?: (href: string) => void;
	/** TV **This season** pins Animation genre — hide genre picks while active. */
	hideGenreFilter?: boolean;
}) {
	const trigger = (
		<button
			type="button"
			className={filtersTriggerClass}
			aria-label={filtersAria}
			title={filtersAria}
		>
			<IconSlider size="1.125rem" className="shrink-0 opacity-95" aria-hidden />
			{hasActiveHomeCatalogFilters(filters) ? (
				<span
					aria-hidden
					className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-accent"
				/>
			) : null}
		</button>
	);

	if (!usePopover) {
		return (
			<Link
				href={filtersHref}
				className={filtersTriggerClass}
				aria-label={filtersAria}
				title={filtersAria}
			>
				<IconSlider
					size="1.125rem"
					className="shrink-0 opacity-95"
					aria-hidden
				/>
			</Link>
		);
	}

	return (
		<HomeCatalogFiltersPopover
			browse={browse}
			venue={venue}
			filters={filters}
			summaryLabel={summaryLabel}
			currentHref={currentHref}
			onNavigate={onNavigate}
			onPrefetch={onPrefetch}
			trigger={trigger}
			hideGenreFilter={hideGenreFilter}
		/>
	);
}

/** Right-rail chip during committed `/home?search=` — exits search mode. */
function HomeCatalogueSearchClearChipToolbar({
	browse,
}: {
	browse: "movies" | "tv";
}) {
	const { navigate } = useLobbyNavigation();

	const chipLink = cn(
		"relative inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-5 py-2.5 text-center font-medium text-muted-foreground text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
		"[@media(hover:hover)]:hover:text-foreground/90",
	);

	const handleClearSearch = () => {
		const persisted = readHomeLobbyPersisted();
		navigate(buildHomeCatalogueSearchClearHref(browse, persisted));
	};

	return (
		<div className="flex shrink-0 flex-col items-end gap-1">
			<div
				className="flex w-fit items-center rounded-full bg-background p-1"
				role="toolbar"
				aria-label="Search"
			>
				<button
					type="button"
					className={chipLink}
					onClick={handleClearSearch}
					title="Clear search and return to the browse catalogue"
					aria-label="Clear search"
				>
					<span className="relative z-10">Clear search</span>
				</button>
			</div>
		</div>
	);
}

/**
 * `/home` **right** toolbar: **In cinemas** vs **At home** when the active sort needs a
 * release window (Movies always; **TV** only on **Upcoming**). **Filters** opens the full
 * scrolling catalogue that matches the current lobby slice.
 */
export function HomeCatalogViewModeToolbar() {
	const pathname = usePathname() ?? "";
	const searchParams = useSearchParams();
	const router = useRouter();
	const { navigate: lobbyNavigate } = useLobbyNavigation();
	const tmdbLobby = useHomeTmdbLobbyParamsOptional();
	const browse = parseHomeBrowseSurface(searchParams.get("browse"));
	const catalogSort = parseHomeCatalogSort(searchParams.get("sort"), browse);
	/** TV slice — `?run=`; legacy `?sort=ongoing|upcoming` maps here until bookmarks update. */
	const sortParam = searchParams.get("sort")?.trim().toLowerCase() ?? "";
	const catalogRunRaw =
		parseHomeCatalogRun(searchParams.get("run"), browse) ??
		(browse === "tv" && ["ongoing", "on-air", "on_the_air"].includes(sortParam)
			? "ongoing"
			: browse === "tv" && ["upcoming", "coming", "soon"].includes(sortParam)
				? "upcoming"
				: null);
	const animeSeasonActive =
		browse === "tv" &&
		(tmdbLobby?.animeSeason ??
			parseHomeAnimeSeason(searchParams.get("animeSeason")));
	const catalogRun = effectiveHomeCatalogRun({
		run: catalogRunRaw,
		browse,
		animeSeason: animeSeasonActive,
	});
	const reduceMotion = useReducedMotion();

	const isHomeLobby = pathname === "/home" || pathname.endsWith("/home");
	const isDiaryLobby = pathname === "/diary" || pathname.endsWith("/diary");
	const isWatchlistLobby =
		pathname === "/watchlist" || pathname.endsWith("/watchlist/");
	const showHomeFiltersPopover =
		isHomeLobby &&
		(browse === "movies" || browse === "tv") &&
		!isDiaryLobby &&
		!isWatchlistLobby;
	const catalogueBrowse = browse === "tv" ? "tv" : "movies";
	const catalogueSearchActive =
		isHomeLobby &&
		browse !== "community" &&
		isHomeCatalogueSearchActive(searchParams, catalogueBrowse);

	if (catalogueSearchActive) {
		return <HomeCatalogueSearchClearChipToolbar browse={catalogueBrowse} />;
	}

	const handleFilterNavigate = (href: string) => {
		if (tmdbLobby && !isDiaryLobby && !isWatchlistLobby) {
			lobbyNavigate(href);
			return;
		}
		router.push(href);
	};

	const filterPrefetch = (href: string) => {
		tmdbLobby?.prefetchLobby(href);
		void router.prefetch(href);
	};

	if (browse === "community" && !isDiaryLobby && !isWatchlistLobby) {
		return null;
	}

	if (isWatchlistLobby) {
		const filtersHref = "/home";
		const filtersAria =
			"Search — find films and TV shows to add to your watchlist";
		return (
			<div className="flex shrink-0 flex-col items-end gap-1">
				<div
					className="flex w-fit items-center rounded-full bg-background p-1"
					role="toolbar"
					aria-label="Catalogue filters"
				>
					<CatalogueFiltersControl
						usePopover={false}
						browse="movies"
						filtersHref={filtersHref}
						filtersAria={filtersAria}
						venue={parseHomeVenue(searchParams.get("venue"), catalogSort)}
						filters={{
							genreId: null,
							monetization: null,
						}}
						summaryLabel=""
						currentHref={filtersHref}
						onNavigate={handleFilterNavigate}
						onPrefetch={filterPrefetch}
					/>
				</div>
			</div>
		);
	}

	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	// Match chip tap targets beside `HomeCatalogSortChips` (left column).
	const chipLink = (active: boolean) =>
		cn(
			"relative inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-5 py-2.5 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const toolbarDescId = "home-catalog-view-mode-desc";

	const discoverSortParam =
		catalogSort === "popular"
			? "popularity.desc"
			: catalogSort === "upcoming"
				? "primary_release_date.asc"
				: "primary_release_date.desc";

	/** UTC `YYYY-MM-DD` — floors streaming “upcoming” discover windows to today. */
	const streamingUpcomingReleaseFloor = new Date().toISOString().slice(0, 10);

	let filtersHref: string;
	let filtersAria: string;

	if (isDiaryLobby) {
		// Diary has no TMDb sort row — mirror **Popular** slice discover targets from venue.
		const diaryVenue = parseDiaryLobbyVenue(searchParams.get("venue"));
		if (diaryVenue === "theaters") {
			filtersHref = buildHomeLobbyHref({
				browse: "movies",
				sort: "popular",
				venue: "theaters",
			});
			filtersAria =
				"Filters — films currently in theatres on the home movies lobby";
		} else {
			filtersHref = discoverCatalogUrl({
				sort: "popularity.desc",
				monetization: "flatrate",
			});
			filtersAria =
				"Filters — popular titles with subscription streaming at home in the catalogue region";
		}
	} else if (browse === "tv") {
		if (animeSeasonActive) {
			const tvLobbySort = catalogSort === "popular" ? "popular" : "latest";
			filtersHref = buildHomeLobbyHref({
				browse: "tv",
				sort: tvLobbySort,
				animeSeason: true,
			});
			filtersAria =
				"Filters — airing animation TV that started within the last 90 days";
		} else if (catalogRun === "ongoing") {
			const tvLobbySort = catalogSort === "popular" ? "popular" : "latest";
			filtersHref = tvDiscoverCatalogUrl({
				sort: tvDiscoverSortByForLobbySort(tvLobbySort),
				status: TV_ONGOING_DISCOVER_STATUS,
			});
			filtersAria =
				"Filters — returning TV series on TMDb discover (full scrolling list)";
		} else if (catalogRun === "completed") {
			const tvLobbySort = catalogSort === "popular" ? "popular" : "latest";
			filtersHref = tvDiscoverCatalogUrl({
				sort: tvDiscoverSortByForLobbySort(tvLobbySort),
				status: TV_COMPLETED_DISCOVER_STATUS,
			});
			filtersAria =
				"Filters — completed TV series on TMDb discover (ended status)";
		} else if (catalogRun === "upcoming") {
			const v = parseTvLobbyVenue(
				searchParams.get("venue"),
				catalogSort,
				catalogRun,
			);
			if (v === "streaming") {
				filtersHref = tvDiscoverCatalogUrl({
					sort: TV_UPCOMING_DISCOVER_SORT,
					airDateGte: streamingUpcomingReleaseFloor,
					monetization: "flatrate",
				});
				filtersAria =
					"Filters — upcoming subscription streaming series from today in the catalogue region";
			} else {
				filtersHref = tvDiscoverCatalogUrl({
					sort: TV_UPCOMING_DISCOVER_SORT,
					airDateGte: streamingUpcomingReleaseFloor,
				});
				filtersAria =
					"Filters — TV discover with first air dates from today onward (all networks)";
			}
		} else {
			const tvLobbySort = catalogSort === "popular" ? "popular" : "latest";
			filtersHref = tvDiscoverCatalogUrl({
				sort: tvDiscoverSortByForLobbySort(tvLobbySort),
			});
			filtersAria = "Filters — TV discover with this sort";
		}
	} else {
		const v = parseHomeVenue(searchParams.get("venue"), catalogSort);
		const explicitVenue = parseExplicitHomeVenue(searchParams.get("venue"));
		if (v === "theaters" && catalogSort === "popular") {
			filtersHref = buildHomeLobbyHref({
				browse: "movies",
				sort: "popular",
				venue: "theaters",
			});
			filtersAria =
				"Filters — in-cinema popular titles on the home movies lobby";
		} else if (v === "theaters" && catalogSort === "latest") {
			filtersHref = discoverCatalogUrl({
				sort: "primary_release_date.desc",
				venue: "theaters",
			});
			filtersAria =
				"Filters — newest films already released in cinemas in this region (TMDb discover)";
		} else if (v === "theaters" && catalogSort === "upcoming") {
			filtersHref = buildHomeLobbyHref({
				browse: "movies",
				sort: "upcoming",
				venue: "theaters",
			});
			filtersAria =
				"Filters — theatrical upcoming releases on the home movies lobby";
		} else if (v === "streaming" && catalogSort === "popular") {
			filtersHref = discoverCatalogUrl({
				sort: "popularity.desc",
				monetization: "flatrate",
			});
			filtersAria =
				"Filters — popular titles with subscription streaming at home in the catalogue region";
		} else if (v === "streaming" && catalogSort === "latest") {
			filtersHref = discoverCatalogUrl({
				sort: "primary_release_date.desc",
				monetization: "flatrate",
			});
			filtersAria =
				"Filters — newest subscription streaming at home in the catalogue region";
		} else if (v === "streaming" && catalogSort === "upcoming") {
			filtersHref = discoverCatalogUrl({
				sort: "primary_release_date.asc",
				monetization: "flatrate",
				releaseGte: streamingUpcomingReleaseFloor,
			});
			filtersAria =
				"Filters — upcoming subscription streaming releases from today in the catalogue region";
		} else {
			filtersHref = discoverCatalogUrl({
				sort: discoverSortParam,
				venue: explicitVenue ?? undefined,
			});
			filtersAria =
				"Filters — discover with this sort (optional theatrical vs digital release type)";
		}
	}

	const currentFilterHref = isHomeLobby
		? `/home?${searchParams.toString()}`
		: filtersHref;

	const isTvCatalogueLobby =
		browse === "tv" && !isDiaryLobby && !isWatchlistLobby;

	const showVenueChips =
		isDiaryLobby ||
		browse === "movies" ||
		(isTvCatalogueLobby && catalogRun === "upcoming");

	/** TV: Ongoing / Completed / Upcoming + filter on the right; venue when Upcoming run is active. */
	if (isTvCatalogueLobby) {
		const effectiveVenue = tmdbLobby
			? tmdbLobby.venue
			: parseTvLobbyVenue(searchParams.get("venue"), catalogSort, catalogRun);
		const activeSort = tmdbLobby?.sort ?? catalogSort;
		const activeRun = tmdbLobby?.run ?? catalogRun;
		const seasonActive = tmdbLobby?.animeSeason ?? animeSeasonActive;
		const theatersActive = effectiveVenue === "theaters";
		const streamingActive = effectiveVenue === "streaming";
		const ongoingActive = !seasonActive && activeRun === "ongoing";
		const completedActive = !seasonActive && activeRun === "completed";
		const upcomingActive = !seasonActive && activeRun === "upcoming";
		const showUpcomingVenue = activeRun === "upcoming";

		const tvRunChipHref = (run: HomeCatalogRun) =>
			buildHomeLobbyHref({
				browse: "tv",
				sort: activeSort,
				venue: showUpcomingVenue ? effectiveVenue : undefined,
				run: run === DEFAULT_HOME_CATALOG_RUN ? null : run,
				animeSeason: false,
			});

		const tvToolbarDescId = "home-catalog-tv-run-desc";
		const tvToolbarCopy =
			"Pick one catalogue slice: Ongoing (all returning series), Completed (ended), or Upcoming (first air dates ahead). Latest, Popular, and This season on the left order or narrow the grid.";

		const runChip = (
			run: HomeCatalogRun,
			label: string,
			title: string,
			ariaLabel: string,
			active: boolean,
		) => {
			const href = tvRunChipHref(run);
			if (tmdbLobby) {
				return (
					<button
						key={run}
						type="button"
						aria-current={active ? "page" : undefined}
						className={chipLink(active)}
						title={title}
						aria-label={ariaLabel}
						onClick={() => tmdbLobby.selectRun(run)}
						onPointerEnter={() => tmdbLobby.prefetchLobby(href)}
					>
						{active ? (
							<motion.span
								className="absolute inset-0 z-0 rounded-full bg-card"
								layoutId="home-catalog-tv-run-pill"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">{label}</span>
					</button>
				);
			}
			return (
				<Link
					key={run}
					href={href}
					scroll={false}
					aria-current={active ? "page" : undefined}
					className={chipLink(active)}
					title={title}
					aria-label={ariaLabel}
				>
					{active ? (
						<motion.span
							className="absolute inset-0 z-0 rounded-full bg-card"
							layoutId="home-catalog-tv-run-pill"
							transition={pillTransition}
						/>
					) : null}
					<span className="relative z-10">{label}</span>
				</Link>
			);
		};

		const venueChip = (
			venue: "theaters" | "streaming",
			label: string,
			title: string,
			ariaLabel: string,
			active: boolean,
		) => {
			const href = buildHomeLobbyHref({
				sort: activeSort,
				browse: "tv",
				venue,
				run: activeRun,
				animeSeason: seasonActive,
			});
			if (tmdbLobby) {
				return (
					<button
						key={venue}
						type="button"
						aria-current={active ? "page" : undefined}
						className={chipLink(active)}
						title={title}
						aria-label={ariaLabel}
						onClick={() => tmdbLobby.selectVenue(venue)}
						onPointerEnter={() => tmdbLobby.prefetchLobby(href)}
					>
						{active ? (
							<motion.span
								className="absolute inset-0 z-0 rounded-full bg-card"
								layoutId="home-catalog-view-mode-pill"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">{label}</span>
					</button>
				);
			}
			return (
				<Link
					key={venue}
					href={href}
					aria-current={active ? "page" : undefined}
					className={chipLink(active)}
					title={title}
					aria-label={ariaLabel}
				>
					{active ? (
						<motion.span
							className="absolute inset-0 z-0 rounded-full bg-card"
							layoutId="home-catalog-view-mode-pill"
							transition={pillTransition}
						/>
					) : null}
					<span className="relative z-10">{label}</span>
				</Link>
			);
		};

		const tvCatalogFilters = parseHomeCatalogFilters(searchParams, {
			venue: effectiveVenue,
			sort: activeSort,
		});
		const tvFilterSummary = (() => {
			const sortLabel = activeSort === "popular" ? "Popular" : "Latest";
			if (seasonActive) return `${sortLabel} · This season`;
			if (activeRun === "ongoing") return `${sortLabel} · Ongoing`;
			if (activeRun === "completed") return `${sortLabel} · Completed`;
			if (activeRun === "upcoming") {
				return `Upcoming · ${effectiveVenue === "theaters" ? "In cinemas" : "At home"}`;
			}
			return sortLabel;
		})();

		return (
			<div className="flex shrink-0 flex-col items-end gap-1">
				<p id={tvToolbarDescId} className="sr-only">
					{tvToolbarCopy}
				</p>
				<div
					className="flex w-fit max-w-full flex-wrap items-center justify-end gap-1 rounded-full bg-background p-1 sm:flex-nowrap"
					role="toolbar"
					aria-label="TV lifecycle and filters"
					aria-describedby={tvToolbarDescId}
				>
					{showUpcomingVenue ? (
						<div className="flex min-w-0">
							{venueChip(
								"theaters",
								"In cinemas",
								"First air dates from today — all networks (TMDb discover)",
								"In cinemas — first air dates ahead on TMDb",
								theatersActive,
							)}
							{venueChip(
								"streaming",
								"At home",
								"Subscription streaming — first air dates from today",
								"At home — subscription streaming catalogue",
								streamingActive,
							)}
						</div>
					) : null}

					{showUpcomingVenue ? (
						<span
							aria-hidden
							className="mx-1 h-6 w-px shrink-0 self-center bg-border/55"
						/>
					) : null}

					<div className="flex min-w-0">
						{runChip(
							"ongoing",
							"Ongoing",
							"Series TMDb marks as Returning (still active, not ended)",
							"Ongoing — returning TV series on TMDb",
							ongoingActive,
						)}
						{runChip(
							"completed",
							"Completed",
							"Series TMDb marks as ended (completed)",
							"Completed — ended TV series on TMDb",
							completedActive,
						)}
						{runChip(
							"upcoming",
							"Upcoming",
							"Shows with first air dates from today onward on TMDb",
							"Upcoming — first air dates ahead on TMDb",
							upcomingActive,
						)}
					</div>

					<span
						aria-hidden
						className="mx-1 h-6 w-px shrink-0 self-center bg-border/55"
					/>

					<CatalogueFiltersControl
						usePopover={showHomeFiltersPopover}
						browse="tv"
						filtersHref={filtersHref}
						filtersAria={filtersAria}
						venue={effectiveVenue}
						filters={tvCatalogFilters}
						summaryLabel={tvFilterSummary}
						currentHref={currentFilterHref}
						onNavigate={handleFilterNavigate}
						onPrefetch={filterPrefetch}
						hideGenreFilter={seasonActive}
					/>
				</div>
			</div>
		);
	}

	if (!showVenueChips) {
		const fallbackVenue = parseHomeVenue(
			searchParams.get("venue"),
			catalogSort,
		);
		return (
			<div className="flex shrink-0 flex-col items-end gap-1">
				<div
					className="flex w-fit items-center rounded-full bg-background p-1"
					role="toolbar"
					aria-label="Catalogue filters"
				>
					<CatalogueFiltersControl
						usePopover={false}
						browse="movies"
						filtersHref={filtersHref}
						filtersAria={filtersAria}
						venue={fallbackVenue}
						filters={{
							genreId: null,
							monetization: null,
						}}
						summaryLabel=""
						currentHref={currentFilterHref}
						onNavigate={handleFilterNavigate}
						onPrefetch={filterPrefetch}
					/>
				</div>
			</div>
		);
	}

	const effectiveVenue = isDiaryLobby
		? parseDiaryLobbyVenue(searchParams.get("venue"))
		: tmdbLobby
			? tmdbLobby.venue
			: parseHomeVenue(searchParams.get("venue"), catalogSort);
	const theatersActive = effectiveVenue === "theaters";
	const streamingActive = effectiveVenue === "streaming";
	const venueBrowse = browse === "tv" ? "tv" : "movies";
	const activeCatalogSort = tmdbLobby?.sort ?? catalogSort;

	const diaryOrder: DiaryLobbyOrder = isDiaryLobby
		? parseDiaryLobbyOrder(searchParams.get("order"))
		: "latest_seen";
	const diaryTab = isDiaryLobby
		? (parseDiaryLedgerTab(searchParams.get("tab")) ?? "movies")
		: "movies";

	const srToolbarCopy = isDiaryLobby
		? "On your diary, In cinemas vs At home sets which catalogue slice the filters button opens; your logged films list is ordered by the left chips."
		: "In cinemas uses TMDb’s theatrical lists: now playing for Popular, newest already released in cinemas for Latest, and opening dates strictly after today for Upcoming so it does not repeat Latest’s same-day openings. At home uses subscription streaming availability in the catalogue region; Upcoming there shows primary releases from today onward, soonest first.";

	const moviesCatalogFilters = parseHomeCatalogFilters(searchParams, {
		venue: effectiveVenue,
		sort: activeCatalogSort,
	});
	const moviesFilterSummary = `${
		activeCatalogSort === "popular"
			? "Popular"
			: activeCatalogSort === "latest"
				? "Latest"
				: "Upcoming"
	} · ${effectiveVenue === "theaters" ? "In cinemas" : "At home"}`;

	return (
		<div className="flex shrink-0 flex-col items-end gap-1">
			<p id={toolbarDescId} className="sr-only">
				{srToolbarCopy}
			</p>
			<div
				className="flex w-fit items-center rounded-full bg-background p-1"
				role="toolbar"
				aria-label="Release window and filters"
				aria-describedby={toolbarDescId}
			>
				<div className="flex min-w-0">
					{(() => {
						const theatersHref = isDiaryLobby
							? buildDiaryLobbyHref({
									order: diaryOrder,
									venue: "theaters",
									tab: diaryTab,
								})
							: buildHomeLobbyHref({
									sort: activeCatalogSort,
									browse: venueBrowse,
									venue: "theaters",
								});
						const theatersTitle = isDiaryLobby
							? "Emphasise in-cinema context for filters and browse"
							: "Now playing (Popular), newest already in cinemas (Latest), or opening soon (Upcoming)";
						const theatersAria = isDiaryLobby
							? "In cinemas — stay on diary"
							: "In cinemas — TMDb theatrical lists";

						if (tmdbLobby && !isDiaryLobby) {
							return (
								<button
									type="button"
									aria-current={theatersActive ? "page" : undefined}
									className={chipLink(theatersActive)}
									title={theatersTitle}
									aria-label={theatersAria}
									onClick={() => tmdbLobby.selectVenue("theaters")}
									onPointerEnter={() => tmdbLobby.prefetchLobby(theatersHref)}
								>
									{theatersActive ? (
										<motion.span
											className="absolute inset-0 z-0 rounded-full bg-card"
											layoutId="home-catalog-view-mode-pill"
											transition={pillTransition}
										/>
									) : null}
									<span className="relative z-10">In cinemas</span>
								</button>
							);
						}

						return (
							<Link
								href={theatersHref}
								aria-current={theatersActive ? "page" : undefined}
								className={chipLink(theatersActive)}
								title={theatersTitle}
								aria-label={theatersAria}
							>
								{theatersActive ? (
									<motion.span
										className="absolute inset-0 z-0 rounded-full bg-card"
										layoutId="home-catalog-view-mode-pill"
										transition={pillTransition}
									/>
								) : null}
								<span className="relative z-10">In cinemas</span>
							</Link>
						);
					})()}
					{(() => {
						const streamingHref = isDiaryLobby
							? buildDiaryLobbyHref({
									order: diaryOrder,
									venue: "streaming",
									tab: diaryTab,
								})
							: buildHomeLobbyHref({
									sort: activeCatalogSort,
									browse: venueBrowse,
									venue: "streaming",
								});
						const streamingTitle = isDiaryLobby
							? "Emphasise at-home streaming context for filters and browse"
							: "Popular, newest, or upcoming subscription streaming at home";
						const streamingAria = isDiaryLobby
							? "At home — stay on diary"
							: "At home — subscription streaming catalogue";

						if (tmdbLobby && !isDiaryLobby) {
							return (
								<button
									type="button"
									aria-current={streamingActive ? "page" : undefined}
									className={chipLink(streamingActive)}
									title={streamingTitle}
									aria-label={streamingAria}
									onClick={() => tmdbLobby.selectVenue("streaming")}
									onPointerEnter={() => tmdbLobby.prefetchLobby(streamingHref)}
								>
									{streamingActive ? (
										<motion.span
											className="absolute inset-0 z-0 rounded-full bg-card"
											layoutId="home-catalog-view-mode-pill"
											transition={pillTransition}
										/>
									) : null}
									<span className="relative z-10">At home</span>
								</button>
							);
						}

						return (
							<Link
								href={streamingHref}
								aria-current={streamingActive ? "page" : undefined}
								className={chipLink(streamingActive)}
								title={streamingTitle}
								aria-label={streamingAria}
							>
								{streamingActive ? (
									<motion.span
										className="absolute inset-0 z-0 rounded-full bg-card"
										layoutId="home-catalog-view-mode-pill"
										transition={pillTransition}
									/>
								) : null}
								<span className="relative z-10">At home</span>
							</Link>
						);
					})()}
				</div>

				<span
					aria-hidden
					className="mx-1 h-6 w-px shrink-0 self-center bg-border/55"
				/>

				<CatalogueFiltersControl
					usePopover={showHomeFiltersPopover && !isDiaryLobby}
					browse="movies"
					filtersHref={filtersHref}
					filtersAria={filtersAria}
					venue={effectiveVenue}
					filters={moviesCatalogFilters}
					summaryLabel={moviesFilterSummary}
					currentHref={currentFilterHref}
					onNavigate={handleFilterNavigate}
					onPrefetch={filterPrefetch}
				/>
			</div>
		</div>
	);
}
