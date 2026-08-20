"use client";

import { useSearchParams } from "next/navigation";

import { useHomeCommunityLobbyParams } from "@/components/home/home-community-lobby-params-context";
import { useHomeTmdbLobbyParams } from "@/components/home/home-tmdb-lobby-params-context";
import { useLobbyNavigation } from "@/components/lobby/lobby-navigation-provider";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import type { HomeBrowseSurface } from "@/lib/home-browse-surface";
import type { HomeCatalogSort } from "@/lib/home-catalog-sort";
import {
	buildHomeCatalogueSearchSortHref,
	isHomeCatalogueSearchActive,
	parseHomeCatalogueSearchLobbySort,
} from "@/lib/home-catalogue-search-param";
import { HOME_COMMUNITY_FEEDS } from "@/lib/home-community-feed";
import { HOME_LOBBY_CHIP_TRACK_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";

type TmdbSortChipId = HomeCatalogSort | "anime_season";

/**
 * Second-row chips on `/home`:
 * - **Movies / TV:** Popular, Latest, and Upcoming (TMDb) with liquid Move pill.
 * - **Community:** Ranks, Lists, Reviews, Activity — member-made surfaces.
 */
function HomeCommunityFeedChips({
	sortToolbarDescId,
	description,
}: {
	sortToolbarDescId: string;
	description: string;
}) {
	const { feed, selectFeed } = useHomeCommunityLobbyParams();

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id={sortToolbarDescId} className="sr-only">
				{description}
			</p>
			<SegmentedPillToolbar
				layoutId="home-catalog-sort-pill"
				aria-label="Community feeds"
				value={feed}
				onChange={selectFeed}
				options={HOME_COMMUNITY_FEEDS.map(({ id, label, hint }) => ({
					id,
					label,
					title: hint,
				}))}
				compact
				className={HOME_LOBBY_CHIP_TRACK_CLASSNAME}
			/>
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

	const activeValue: TmdbSortChipId = animeSeason
		? "anime_season"
		: searchActive
			? (searchLobbySort ?? "popular")
			: catalogSort;

	const options: {
		id: TmdbSortChipId;
		label: string;
		title: string;
	}[] = [
		{
			id: "popular",
			label: "Popular",
			title: searchActive
				? "Most popular matches first"
				: "Trending and most popular on TMDb right now",
		},
		{
			id: "latest",
			label: "Latest",
			title: searchActive
				? "Newest matching releases first"
				: "Newest releases first in this TMDb catalogue",
		},
	];

	if (browse !== "tv" && !searchActive) {
		options.push({
			id: "upcoming",
			label: "Upcoming",
			title:
				"Theatrical or streaming titles with primary release dates from today onward",
		});
	}

	if (browse === "tv" && !searchActive) {
		options.push({
			id: "anime_season",
			label: "This season",
			title:
				"Animation TV that started airing within the last 90 days and is still returning",
		});
	}

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id={sortToolbarDescId} className="sr-only">
				{description}
			</p>
			<SegmentedPillToolbar
				layoutId="home-catalog-sort-pill"
				aria-label="Catalogue sort"
				value={activeValue}
				onChange={(next) => {
					if (next === "anime_season") {
						selectAnimeSeason();
						return;
					}
					if (searchActive) {
						// Search lobby only exposes Popular · Latest.
						if (next !== "popular" && next !== "latest") return;
						if (searchLobbySort === next) return;
						navigate(
							buildHomeCatalogueSearchSortHref({
								browse: catalogueBrowse,
								sort: next,
								currentParams: new URLSearchParams(searchParams.toString()),
							}),
						);
						return;
					}
					selectSort(next);
				}}
				onOptionPointerEnter={(id) => {
					if (id === "anime_season") {
						prefetchLobby(
							buildHomeLobbyHref({
								sort: catalogSort,
								browse,
								venue,
								animeSeason: !animeSeason,
								run: null,
							}),
						);
						return;
					}
					if (searchActive) {
						if (id !== "popular" && id !== "latest") return;
						prefetchLobby(
							buildHomeCatalogueSearchSortHref({
								browse: catalogueBrowse,
								sort: id,
								currentParams: new URLSearchParams(searchParams.toString()),
							}),
						);
						return;
					}
					prefetchLobby(
						buildHomeLobbyHref({
							sort: id,
							browse,
							venue,
							run: catalogRun,
							animeSeason,
						}),
					);
				}}
				options={options}
				compact
				className={HOME_LOBBY_CHIP_TRACK_CLASSNAME}
			/>
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
			? "Choose what kind of member-made content to browse — public lists, reviews, activity, or patron rankings. Switch Films or Shows in the center when Ranks is active."
			: catalogBrowse === "tv"
				? searchParams.get("search")?.trim()
					? "Popular and Latest reorder committed search results. Clear search from the chip on the right."
					: "Popular and Latest choose TMDb ordering. This season narrows to airing animation from the last 90 days. Ongoing, Completed, and Upcoming on the right pick a different catalogue slice — only one right-rail slice at a time."
				: searchParams.get("search")?.trim()
					? "Popular and Latest reorder committed search results. Clear search from the chip on the right."
					: "Popular, Latest, and Upcoming choose the TMDb list or discover sort. On Movies, the right rail picks theatrical versus at-home digital releases — same knobs carry into Filters on discover.";

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
