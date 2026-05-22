"use client";

import IconSlider from "@still/ui/icons/slider";
import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import {
	buildDiaryLobbyHref,
	type DiaryLobbyOrder,
	parseDiaryLobbyOrder,
	parseDiaryLobbyVenue,
} from "@/lib/diary-lobby-order";
import { discoverCatalogUrl } from "@/lib/discover-catalog-url";
import { parseHomeBrowseSurface } from "@/lib/home-browse-surface";
import {
	type HomeCatalogRun,
	parseHomeCatalogRun,
	TV_COMPLETED_DISCOVER_STATUS,
	TV_ONGOING_DISCOVER_STATUS,
	TV_UPCOMING_DISCOVER_SORT,
	tvDiscoverSortByForLobbySort,
} from "@/lib/home-catalog-run";
import { parseHomeCatalogSort } from "@/lib/home-catalog-sort";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import {
	parseExplicitHomeVenue,
	parseHomeVenue,
	parseTvLobbyVenue,
} from "@/lib/home-venue";
import { tvDiscoverCatalogUrl } from "@/lib/tv-discover-catalog-url";

/**
 * `/home` **right** toolbar: **In cinemas** vs **At home** when the active sort needs a
 * release window (Movies always; **TV** only on **Upcoming**). **Filters** opens the full
 * scrolling catalogue that matches the current lobby slice.
 */
export function HomeCatalogViewModeToolbar() {
	const pathname = usePathname() ?? "";
	const searchParams = useSearchParams();
	const browse = parseHomeBrowseSurface(searchParams.get("browse"));
	const catalogSort = parseHomeCatalogSort(searchParams.get("sort"), browse);
	/** TV slice — `?run=`; legacy `?sort=ongoing|upcoming` maps here until bookmarks update. */
	const sortParam = searchParams.get("sort")?.trim().toLowerCase() ?? "";
	const catalogRun =
		parseHomeCatalogRun(searchParams.get("run"), browse) ??
		(browse === "tv" && ["ongoing", "on-air", "on_the_air"].includes(sortParam)
			? "ongoing"
			: browse === "tv" && ["upcoming", "coming", "soon"].includes(sortParam)
				? "upcoming"
				: null);
	const reduceMotion = useReducedMotion();

	/** `/diary` reuses this toolbar — venue + filters must stay on diary URLs, not `/home`. */
	const isDiaryLobby = pathname === "/diary" || pathname.endsWith("/diary");
	/** `/watchlist` lobby — no theatrical vs streaming rail; keep filters only (same chrome shell as `/home`). */
	const isWatchlistLobby =
		pathname === "/watchlist" || pathname.endsWith("/watchlist/");

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
					<Link
						href={filtersHref}
						className={cn(
							"inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors duration-200 ease-out motion-reduce:transition-none",
							"[@media(hover:hover)]:hover:bg-card/55 [@media(hover:hover)]:hover:text-foreground",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
						)}
						aria-label={filtersAria}
						title={filtersAria}
					>
						<IconSlider
							size="1.125rem"
							className="shrink-0 opacity-95"
							aria-hidden
						/>
					</Link>
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
		if (catalogRun === "ongoing") {
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

	const isTvCatalogueLobby =
		browse === "tv" && !isDiaryLobby && !isWatchlistLobby;

	const showVenueChips =
		isDiaryLobby ||
		browse === "movies" ||
		(isTvCatalogueLobby && catalogRun === "upcoming");

	/** TV: Ongoing / Completed / Upcoming + filter on the right; venue when Upcoming run is active. */
	if (isTvCatalogueLobby) {
		const effectiveVenue = parseTvLobbyVenue(
			searchParams.get("venue"),
			catalogSort,
			catalogRun,
		);
		const theatersActive = effectiveVenue === "theaters";
		const streamingActive = effectiveVenue === "streaming";
		const ongoingActive = catalogRun === "ongoing";
		const completedActive = catalogRun === "completed";
		const upcomingActive = catalogRun === "upcoming";
		const showUpcomingVenue = catalogRun === "upcoming";

		const tvRunChipHref = (run: HomeCatalogRun) =>
			buildHomeLobbyHref({
				browse: "tv",
				sort: catalogSort,
				venue: showUpcomingVenue ? effectiveVenue : undefined,
				run: catalogRun === run ? null : run,
			});

		const tvToolbarDescId = "home-catalog-tv-run-desc";
		const tvToolbarCopy =
			"Pick one catalogue slice: Ongoing (TMDb returning series), Completed (ended), or Upcoming (first air dates ahead). Popular and Latest on the left order titles inside each slice. Ongoing and Completed do not overlap. Upcoming can narrow In cinemas versus At home.";

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
							<Link
								href={buildHomeLobbyHref({
									sort: catalogSort,
									browse: "tv",
									venue: "theaters",
									run: catalogRun,
								})}
								aria-current={theatersActive ? "page" : undefined}
								className={chipLink(theatersActive)}
								title="First air dates from today — all networks (TMDb discover)"
								aria-label="In cinemas — first air dates ahead on TMDb"
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
							<Link
								href={buildHomeLobbyHref({
									sort: catalogSort,
									browse: "tv",
									venue: "streaming",
									run: catalogRun,
								})}
								aria-current={streamingActive ? "page" : undefined}
								className={chipLink(streamingActive)}
								title="Subscription streaming — first air dates from today"
								aria-label="At home — subscription streaming catalogue"
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
						</div>
					) : null}

					{showUpcomingVenue ? (
						<span
							aria-hidden
							className="mx-1 h-6 w-px shrink-0 self-center bg-border/55"
						/>
					) : null}

					<div className="flex min-w-0">
						<Link
							href={tvRunChipHref("ongoing")}
							scroll={false}
							aria-current={ongoingActive ? "page" : undefined}
							className={chipLink(ongoingActive)}
							title="Series TMDb marks as Returning (still active, not ended)"
							aria-label="Ongoing — returning TV series on TMDb"
						>
							{ongoingActive ? (
								<motion.span
									className="absolute inset-0 z-0 rounded-full bg-card"
									layoutId="home-catalog-tv-run-pill"
									transition={pillTransition}
								/>
							) : null}
							<span className="relative z-10">Ongoing</span>
						</Link>
						<Link
							href={tvRunChipHref("completed")}
							scroll={false}
							aria-current={completedActive ? "page" : undefined}
							className={chipLink(completedActive)}
							title="Series TMDb marks as ended (completed)"
							aria-label="Completed — ended TV series on TMDb"
						>
							{completedActive ? (
								<motion.span
									className="absolute inset-0 z-0 rounded-full bg-card"
									layoutId="home-catalog-tv-run-pill"
									transition={pillTransition}
								/>
							) : null}
							<span className="relative z-10">Completed</span>
						</Link>
						<Link
							href={tvRunChipHref("upcoming")}
							scroll={false}
							aria-current={upcomingActive ? "page" : undefined}
							className={chipLink(upcomingActive)}
							title="Shows with first air dates from today onward on TMDb"
							aria-label="Upcoming — first air dates ahead on TMDb"
						>
							{upcomingActive ? (
								<motion.span
									className="absolute inset-0 z-0 rounded-full bg-card"
									layoutId="home-catalog-tv-run-pill"
									transition={pillTransition}
								/>
							) : null}
							<span className="relative z-10">Upcoming</span>
						</Link>
					</div>

					<span
						aria-hidden
						className="mx-1 h-6 w-px shrink-0 self-center bg-border/55"
					/>

					<Link
						href={filtersHref}
						className={cn(
							"inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors duration-200 ease-out motion-reduce:transition-none",
							"[@media(hover:hover)]:hover:bg-card/55 [@media(hover:hover)]:hover:text-foreground",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
						)}
						aria-label={filtersAria}
						title={filtersAria}
					>
						<IconSlider
							size="1.125rem"
							className="shrink-0 opacity-95"
							aria-hidden
						/>
					</Link>
				</div>
			</div>
		);
	}

	if (!showVenueChips) {
		return (
			<div className="flex shrink-0 flex-col items-end gap-1">
				<div
					className="flex w-fit items-center rounded-full bg-background p-1"
					role="toolbar"
					aria-label="Catalogue filters"
				>
					<Link
						href={filtersHref}
						className={cn(
							"inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors duration-200 ease-out motion-reduce:transition-none",
							"[@media(hover:hover)]:hover:bg-card/55 [@media(hover:hover)]:hover:text-foreground",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
						)}
						aria-label={filtersAria}
						title={filtersAria}
					>
						<IconSlider
							size="1.125rem"
							className="shrink-0 opacity-95"
							aria-hidden
						/>
					</Link>
				</div>
			</div>
		);
	}

	const effectiveVenue = isDiaryLobby
		? parseDiaryLobbyVenue(searchParams.get("venue"))
		: parseHomeVenue(searchParams.get("venue"), catalogSort);
	const theatersActive = effectiveVenue === "theaters";
	const streamingActive = effectiveVenue === "streaming";
	const venueBrowse = browse === "tv" ? "tv" : "movies";

	const diaryOrder: DiaryLobbyOrder = isDiaryLobby
		? parseDiaryLobbyOrder(searchParams.get("order"))
		: "latest_seen";

	const srToolbarCopy = isDiaryLobby
		? "On your diary, In cinemas vs At home sets which catalogue slice the filters button opens; your logged films list is ordered by the left chips."
		: "In cinemas uses TMDb’s theatrical lists: now playing for Popular, newest already released in cinemas for Latest, and opening dates strictly after today for Upcoming so it does not repeat Latest’s same-day openings. At home uses subscription streaming availability in the catalogue region; Upcoming there shows primary releases from today onward, soonest first.";

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
					<Link
						href={
							isDiaryLobby
								? buildDiaryLobbyHref({
										order: diaryOrder,
										venue: "theaters",
									})
								: buildHomeLobbyHref({
										sort: catalogSort,
										browse: venueBrowse,
										venue: "theaters",
									})
						}
						aria-current={theatersActive ? "page" : undefined}
						className={chipLink(theatersActive)}
						title={
							isDiaryLobby
								? "Emphasise in-cinema context for filters and browse"
								: "Now playing (Popular), newest already in cinemas (Latest), or opening soon (Upcoming)"
						}
						aria-label={
							isDiaryLobby
								? "In cinemas — stay on diary"
								: "In cinemas — TMDb theatrical lists"
						}
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
					<Link
						href={
							isDiaryLobby
								? buildDiaryLobbyHref({
										order: diaryOrder,
										venue: "streaming",
									})
								: buildHomeLobbyHref({
										sort: catalogSort,
										browse: venueBrowse,
										venue: "streaming",
									})
						}
						aria-current={streamingActive ? "page" : undefined}
						className={chipLink(streamingActive)}
						title={
							isDiaryLobby
								? "Emphasise at-home streaming context for filters and browse"
								: "Popular, newest, or upcoming subscription streaming at home"
						}
						aria-label={
							isDiaryLobby
								? "At home — stay on diary"
								: "At home — subscription streaming catalogue"
						}
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
				</div>

				<span
					aria-hidden
					className="mx-1 h-6 w-px shrink-0 self-center bg-border/55"
				/>

				<Link
					href={filtersHref}
					className={cn(
						"inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors duration-200 ease-out motion-reduce:transition-none",
						"[@media(hover:hover)]:hover:bg-card/55 [@media(hover:hover)]:hover:text-foreground",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
					)}
					aria-label={filtersAria}
					title={filtersAria}
				>
					<IconSlider
						size="1.125rem"
						className="shrink-0 opacity-95"
						aria-hidden
					/>
				</Link>
			</div>
		</div>
	);
}
