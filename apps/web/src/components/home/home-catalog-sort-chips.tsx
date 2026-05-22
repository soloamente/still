"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { parseHomeBrowseSurface } from "@/lib/home-browse-surface";
import { parseHomeCatalogRun } from "@/lib/home-catalog-run";
import { parseHomeCatalogSort } from "@/lib/home-catalog-sort";
import {
	HOME_COMMUNITY_FEEDS,
	parseHomeCommunityFeed,
} from "@/lib/home-community-feed";
import { parseHomeCommunityPeriod } from "@/lib/home-leaderboard-period";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import { parseHomeVenue } from "@/lib/home-venue";

/**
 * Second-row chips on `/home`:
 * - **Movies / TV:** Upcoming, Latest, and Popular (TMDb) with a sliding `layoutId` pill.
 * - **Community:** Lists, Reviews, Diary, Activity — member-made surfaces.
 */
export function HomeCatalogSortChips() {
	const searchParams = useSearchParams();
	const browse = parseHomeBrowseSurface(searchParams.get("browse"));
	const catalogSort = parseHomeCatalogSort(searchParams.get("sort"), browse);
	/** TV lifecycle filter — preserved when switching Popular / Latest / Upcoming. */
	const catalogRun = parseHomeCatalogRun(searchParams.get("run"), browse);
	const communityFeed = parseHomeCommunityFeed(searchParams.get("sort"));
	const communityPeriod = parseHomeCommunityPeriod(searchParams.get("period"));
	const effectiveVenue = parseHomeVenue(searchParams.get("venue"), catalogSort);
	const reduceMotion = useReducedMotion();

	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const chipLink = (active: boolean, compact: boolean) =>
		cn(
			"relative inline-flex min-h-10 items-center justify-center rounded-full text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			compact ? "px-3 py-2 sm:px-3.5" : "px-5 py-2.5",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const sortToolbarDescId = "home-catalog-sort-desc";
	const sortToolbarDescription =
		browse === "community"
			? "Choose what kind of member-made content to browse — public lists, reviews, or activity from people you follow."
			: browse === "tv"
				? "Latest and Popular choose the TMDb ordering. Ongoing, Completed, and Upcoming on the right pick the catalogue slice — only one at a time. On Movies, all three sorts stay on the left; the right rail picks theatrical versus at-home releases."
				: "Upcoming, Latest, and Popular choose the TMDb list or discover sort. On Movies, the right rail picks theatrical versus at-home digital releases — same knobs carry into Filters on discover.";

	if (browse === "community") {
		return (
			<div className="flex min-w-0 flex-col gap-1">
				<p id={sortToolbarDescId} className="sr-only">
					{sortToolbarDescription}
				</p>
				<div
					className="flex w-fit max-w-full flex-wrap gap-1 rounded-full bg-background p-1 sm:flex-nowrap"
					role="toolbar"
					aria-label="Community feeds"
					aria-describedby={sortToolbarDescId}
				>
					{HOME_COMMUNITY_FEEDS.map(({ id, label, hint }) => (
						<Link
							key={id}
							href={buildHomeLobbyHref({
								browse: "community",
								sort: id,
								period: communityPeriod,
							})}
							scroll={false}
							aria-current={communityFeed === id ? "page" : undefined}
							className={chipLink(communityFeed === id, true)}
							title={hint}
							aria-label={`${label} — ${hint}`}
						>
							{communityFeed === id ? (
								<motion.span
									layoutId="home-catalog-sort-pill"
									className="absolute inset-0 z-0 rounded-full bg-card"
									transition={pillTransition}
								/>
							) : null}
							<span className="relative z-10">{label}</span>
						</Link>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id={sortToolbarDescId} className="sr-only">
				{sortToolbarDescription}
			</p>
			<div
				className="flex max-w-full flex-wrap gap-1 rounded-full bg-background p-1 sm:flex-nowrap"
				role="toolbar"
				aria-label="Catalogue sort"
				aria-describedby={sortToolbarDescId}
			>
				{browse !== "tv" ? (
					<Link
						href={buildHomeLobbyHref({
							sort: "upcoming",
							browse,
							venue: effectiveVenue,
						})}
						scroll={false}
						aria-current={catalogSort === "upcoming" ? "page" : undefined}
						className={chipLink(catalogSort === "upcoming", true)}
						title="Theatrical or streaming titles with primary release dates from today onward"
						aria-label="Upcoming — releases ahead on TMDb"
					>
						{catalogSort === "upcoming" ? (
							<motion.span
								layoutId="home-catalog-sort-pill"
								className="absolute inset-0 z-0 rounded-full bg-card"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">Upcoming</span>
					</Link>
				) : null}
				<Link
					href={buildHomeLobbyHref({
						sort: "latest",
						browse,
						venue: effectiveVenue,
						run: catalogRun,
					})}
					scroll={false}
					aria-current={catalogSort === "latest" ? "page" : undefined}
					className={chipLink(catalogSort === "latest", true)}
					title="Newest releases first in this TMDb catalogue"
					aria-label="Latest — newest releases in this TMDb catalogue"
				>
					{catalogSort === "latest" ? (
						<motion.span
							layoutId="home-catalog-sort-pill"
							className="absolute inset-0 z-0 rounded-full bg-card"
							transition={pillTransition}
						/>
					) : null}
					<span className="relative z-10">Latest</span>
				</Link>
				<Link
					href={buildHomeLobbyHref({
						sort: "popular",
						browse,
						venue: effectiveVenue,
						run: catalogRun,
					})}
					scroll={false}
					aria-current={catalogSort === "popular" ? "page" : undefined}
					className={chipLink(catalogSort === "popular", true)}
					title="Trending and most popular on TMDb right now"
					aria-label="Popular — trending titles on TMDb"
				>
					{catalogSort === "popular" ? (
						<motion.span
							layoutId="home-catalog-sort-pill"
							className="absolute inset-0 z-0 rounded-full bg-card"
							transition={pillTransition}
						/>
					) : null}
					<span className="relative z-10">Popular</span>
				</Link>
			</div>
		</div>
	);
}
