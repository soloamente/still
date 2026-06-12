"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useHomeCommunityLobbyParams } from "@/components/home/home-community-lobby-params-context";
import { useHomeTmdbLobbyParams } from "@/components/home/home-tmdb-lobby-params-context";
import { useLobbyNavigation } from "@/components/lobby/lobby-navigation-provider";
import type { HomeBrowseSurface } from "@/lib/home-browse-surface";
import {
	buildHomeCatalogueSearchSortHref,
	isHomeCatalogueSearchActive,
	parseHomeCatalogueSearchLobbySort,
} from "@/lib/home-catalogue-search-param";
import { HOME_COMMUNITY_FEEDS } from "@/lib/home-community-feed";
import {
	HOME_LOBBY_CHIP_BUTTON_CLASSNAME,
	HOME_LOBBY_CHIP_TRACK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";

/**
 * Second-row chips on `/home`:
 * - **Movies / TV:** Upcoming, Latest, and Popular (TMDb) with a sliding `layoutId` pill.
 * - **Community:** Lists, Reviews, Diary, Activity — member-made surfaces.
 */
function HomeCommunityFeedChips({
	sortToolbarDescId,
	description,
}: {
	sortToolbarDescId: string;
	description: string;
}) {
	const { feed, selectFeed } = useHomeCommunityLobbyParams();
	const reduceMotion = useReducedMotion();
	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const chipButton = (active: boolean) =>
		cn(
			HOME_LOBBY_CHIP_BUTTON_CLASSNAME,
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id={sortToolbarDescId} className="sr-only">
				{description}
			</p>
			<div
				className={HOME_LOBBY_CHIP_TRACK_CLASSNAME}
				role="toolbar"
				aria-label="Community feeds"
				aria-describedby={sortToolbarDescId}
			>
				{HOME_COMMUNITY_FEEDS.map(({ id, label, hint }) => (
					<button
						key={id}
						type="button"
						aria-current={feed === id ? "page" : undefined}
						className={chipButton(feed === id)}
						title={hint}
						aria-label={`${label} — ${hint}`}
						onClick={() => selectFeed(id)}
					>
						{feed === id ? (
							<motion.span
								layoutId="home-catalog-sort-pill"
								className="absolute inset-0 z-0 rounded-full bg-card"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">{label}</span>
					</button>
				))}
			</div>
		</div>
	);
}

/** Movies·TV sort rail on `/home` — instant `navigate` + prefetch (inside `HomeTmdbLobbyChrome`). */
function HomeTmdbSortChips({
	sortToolbarDescId,
	description,
}: {
	sortToolbarDescId: string;
	description: string;
}) {
	const {
		browse,
		sort: catalogSort,
		venue,
		run: catalogRun,
		animeSeason,
		selectSort,
		selectAnimeSeason,
		prefetchLobby,
	} = useHomeTmdbLobbyParams();
	const searchParams = useSearchParams();
	const { navigate } = useLobbyNavigation();
	const catalogueBrowse = browse === "tv" ? "tv" : "movies";
	const searchActive = isHomeCatalogueSearchActive(
		searchParams,
		catalogueBrowse,
	);
	const searchLobbySort = searchActive
		? parseHomeCatalogueSearchLobbySort(searchParams, catalogueBrowse)
		: null;
	const reduceMotion = useReducedMotion();

	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const chipButton = (active: boolean) =>
		cn(
			HOME_LOBBY_CHIP_BUTTON_CLASSNAME,
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const chipForUpcoming = () => {
		const sort = "upcoming" as const;
		const href = buildHomeLobbyHref({
			sort,
			browse,
			venue,
			run: catalogRun,
			animeSeason,
		});
		const active = catalogSort === sort;
		return (
			<button
				key={sort}
				type="button"
				aria-current={active ? "page" : undefined}
				className={chipButton(active)}
				title="Theatrical or streaming titles with primary release dates from today onward"
				aria-label="Upcoming — releases ahead on TMDb"
				onClick={() => selectSort(sort)}
				onPointerEnter={() => prefetchLobby(href)}
			>
				{active ? (
					<motion.span
						layoutId="home-catalog-sort-pill"
						className="absolute inset-0 z-0 rounded-full bg-card"
						transition={pillTransition}
					/>
				) : null}
				<span className="relative z-10">Upcoming</span>
			</button>
		);
	};

	const chipFor = (sort: "latest" | "popular") => {
		const href = searchActive
			? buildHomeCatalogueSearchSortHref({
					browse: catalogueBrowse,
					sort,
					currentParams: new URLSearchParams(searchParams.toString()),
				})
			: buildHomeLobbyHref({
					sort,
					browse,
					venue,
					run: catalogRun,
					animeSeason,
				});
		const active = searchActive
			? searchLobbySort === sort
			: catalogSort === sort;
		const labels =
			sort === "latest"
				? {
						label: "Latest",
						title: searchActive
							? "Newest matching releases first"
							: "Newest releases first in this TMDb catalogue",
						ariaLabel: searchActive
							? "Latest — newest matching releases first"
							: "Latest — newest releases in this TMDb catalogue",
					}
				: {
						label: "Popular",
						title: searchActive
							? "Most popular matches first"
							: "Trending and most popular on TMDb right now",
						ariaLabel: searchActive
							? "Popular — most popular matches first"
							: "Popular — trending titles on TMDb",
					};

		return (
			<button
				key={sort}
				type="button"
				aria-current={active ? "page" : undefined}
				className={chipButton(active)}
				title={labels.title}
				aria-label={labels.ariaLabel}
				onClick={() => {
					if (searchActive) {
						if (searchLobbySort === sort) return;
						navigate(href);
						return;
					}
					selectSort(sort);
				}}
				onPointerEnter={() => prefetchLobby(href)}
			>
				{active ? (
					<motion.span
						layoutId="home-catalog-sort-pill"
						className="absolute inset-0 z-0 rounded-full bg-card"
						transition={pillTransition}
					/>
				) : null}
				<span className="relative z-10">{labels.label}</span>
			</button>
		);
	};

	const seasonChipHref = buildHomeLobbyHref({
		sort: catalogSort,
		browse,
		venue,
		animeSeason: !animeSeason,
		run: null,
	});

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id={sortToolbarDescId} className="sr-only">
				{description}
			</p>
			<div
				className={HOME_LOBBY_CHIP_TRACK_CLASSNAME}
				role="toolbar"
				aria-label="Catalogue sort"
				aria-describedby={sortToolbarDescId}
			>
				{browse !== "tv" && !searchActive ? chipForUpcoming() : null}
				{chipFor("latest")}
				{chipFor("popular")}
				{browse === "tv" && !searchActive ? (
					<button
						type="button"
						aria-current={animeSeason ? "page" : undefined}
						className={chipButton(animeSeason)}
						title="Animation TV that started airing within the last 90 days and is still returning"
						aria-label="This season — airing anime simulcasts"
						onClick={() => selectAnimeSeason()}
						onPointerEnter={() => prefetchLobby(seasonChipHref)}
					>
						{animeSeason ? (
							<motion.span
								layoutId="home-catalog-anime-season-pill"
								className="absolute inset-0 z-0 rounded-full bg-card"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">This season</span>
					</button>
				) : null}
			</div>
		</div>
	);
}

/**
 * Chip rail variant comes from the parent RSC branch — not client `?browse=`.
 * Otherwise a fast Community URL update can mount community chips inside the
 * Movies·TV provider tree (no `HomeCommunityLobbyParamsProvider`).
 */
export function HomeCatalogSortChips({
	catalogBrowse,
}: {
	catalogBrowse: HomeBrowseSurface;
}) {
	const searchParams = useSearchParams();

	const sortToolbarDescId = "home-catalog-sort-desc";
	const sortToolbarDescription =
		catalogBrowse === "community"
			? "Choose what kind of member-made content to browse — public lists, reviews, activity, or patron rankings. Switch Films or TV on the right when Ranks is active."
			: catalogBrowse === "tv"
				? searchParams.get("search")?.trim()
					? "Latest and Popular reorder committed search results. Clear search from the chip on the right."
					: "Latest and Popular choose TMDb ordering. This season narrows to airing animation from the last 90 days. Ongoing, Completed, and Upcoming on the right pick a different catalogue slice — only one right-rail slice at a time."
				: searchParams.get("search")?.trim()
					? "Latest and Popular reorder committed search results. Clear search from the chip on the right."
					: "Upcoming, Latest, and Popular choose the TMDb list or discover sort. On Movies, the right rail picks theatrical versus at-home digital releases — same knobs carry into Filters on discover.";

	if (catalogBrowse === "community") {
		return (
			<HomeCommunityFeedChips
				sortToolbarDescId={sortToolbarDescId}
				description={sortToolbarDescription}
			/>
		);
	}

	return (
		<HomeTmdbSortChips
			sortToolbarDescId={sortToolbarDescId}
			description={sortToolbarDescription}
		/>
	);
}
