"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { useSearchParams } from "next/navigation";

import { useHomeCommunityLobbyParams } from "@/components/home/home-community-lobby-params-context";
import { useHomeTmdbLobbyParams } from "@/components/home/home-tmdb-lobby-params-context";
import { parseHomeBrowseSurface } from "@/lib/home-browse-surface";
import { HOME_COMMUNITY_FEEDS } from "@/lib/home-community-feed";
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
			"relative inline-flex min-h-10 items-center justify-center rounded-full px-3 py-2 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none sm:px-3.5",
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
				className="flex w-fit max-w-full flex-wrap gap-1 rounded-full bg-background p-1 sm:flex-nowrap"
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
		selectSort,
		prefetchLobby,
	} = useHomeTmdbLobbyParams();
	const reduceMotion = useReducedMotion();

	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const chipButton = (active: boolean, compact: boolean) =>
		cn(
			"relative inline-flex min-h-10 items-center justify-center rounded-full text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			compact ? "px-3 py-2 sm:px-3.5" : "px-5 py-2.5",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const chipFor = (sort: "upcoming" | "latest" | "popular") => {
		const href = buildHomeLobbyHref({
			sort,
			browse,
			venue,
			run: catalogRun,
		});
		const active = catalogSort === sort;
		const labels =
			sort === "upcoming"
				? {
						label: "Upcoming",
						title:
							"Theatrical or streaming titles with primary release dates from today onward",
						ariaLabel: "Upcoming — releases ahead on TMDb",
					}
				: sort === "latest"
					? {
							label: "Latest",
							title: "Newest releases first in this TMDb catalogue",
							ariaLabel: "Latest — newest releases in this TMDb catalogue",
						}
					: {
							label: "Popular",
							title: "Trending and most popular on TMDb right now",
							ariaLabel: "Popular — trending titles on TMDb",
						};

		return (
			<button
				key={sort}
				type="button"
				aria-current={active ? "page" : undefined}
				className={chipButton(active, true)}
				title={labels.title}
				aria-label={labels.ariaLabel}
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
				<span className="relative z-10">{labels.label}</span>
			</button>
		);
	};

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id={sortToolbarDescId} className="sr-only">
				{description}
			</p>
			<div
				className="flex max-w-full flex-wrap gap-1 rounded-full bg-background p-1 sm:flex-nowrap"
				role="toolbar"
				aria-label="Catalogue sort"
				aria-describedby={sortToolbarDescId}
			>
				{browse !== "tv" ? chipFor("upcoming") : null}
				{chipFor("latest")}
				{chipFor("popular")}
			</div>
		</div>
	);
}

export function HomeCatalogSortChips() {
	const searchParams = useSearchParams();
	const browse = parseHomeBrowseSurface(searchParams.get("browse"));

	const sortToolbarDescId = "home-catalog-sort-desc";
	const sortToolbarDescription =
		browse === "community"
			? "Choose what kind of member-made content to browse — public lists, reviews, or activity from people you follow."
			: browse === "tv"
				? "Latest and Popular choose the TMDb ordering. Ongoing, Completed, and Upcoming on the right pick the catalogue slice — only one at a time. On Movies, all three sorts stay on the left; the right rail picks theatrical versus at-home releases."
				: "Upcoming, Latest, and Popular choose the TMDb list or discover sort. On Movies, the right rail picks theatrical versus at-home digital releases — same knobs carry into Filters on discover.";

	if (browse === "community") {
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
