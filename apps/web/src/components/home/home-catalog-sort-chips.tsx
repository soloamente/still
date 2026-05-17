"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { parseHomeBrowseSurface } from "@/lib/home-browse-surface";
import { parseHomeCatalogSort } from "@/lib/home-catalog-sort";
import {
	HOME_COMMUNITY_FEEDS,
	parseHomeCommunityFeed,
} from "@/lib/home-community-feed";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";

/**
 * Second-row chips on `/home`:
 * - **Movies / TV:** Latest ↔ Popular (TMDb) with a sliding `layoutId` pill.
 * - **Community:** Lists, Reviews, Diary, Activity — member-made surfaces (URLs only; lobby body still WIP).
 */
export function HomeCatalogSortChips() {
	const searchParams = useSearchParams();
	const catalogSort = parseHomeCatalogSort(searchParams.get("sort"));
	const browse = parseHomeBrowseSurface(searchParams.get("browse"));
	const communityFeed = parseHomeCommunityFeed(searchParams.get("sort"));
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
			? "Choose what kind of member-made content you want to browse first — lists, reviews, diary logs, or activity. Each tab will open its own community rail when the feature ships."
			: "Popular highlights trending titles on TMDb. Latest prefers the newest theatrical or streaming releases in this catalogue.";

	if (browse === "community") {
		return (
			<div className="flex min-w-0 flex-col gap-1">
				<p id={sortToolbarDescId} className="sr-only">
					{sortToolbarDescription}
				</p>
				<div
					className="flex max-w-full flex-wrap gap-1 rounded-full bg-background p-1 sm:flex-nowrap"
					role="toolbar"
					aria-label="Community feeds"
					aria-describedby={sortToolbarDescId}
				>
					{HOME_COMMUNITY_FEEDS.map(({ id, label, hint }) => (
						<Link
							key={id}
							href={buildHomeLobbyHref({ browse: "community", sort: id })}
							aria-current={communityFeed === id ? "page" : undefined}
							className={chipLink(communityFeed === id, true)}
							title={`${label} — ${hint} (coming soon)`}
							aria-label={`${label} — ${hint}. Coming soon.`}
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
				className="flex w-fit rounded-full bg-background p-1"
				role="toolbar"
				aria-label="Catalogue sort"
				aria-describedby={sortToolbarDescId}
			>
				<Link
					href={buildHomeLobbyHref({ sort: "latest", browse })}
					aria-current={catalogSort === "latest" ? "page" : undefined}
					className={chipLink(catalogSort === "latest", false)}
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
					href={buildHomeLobbyHref({ sort: "popular", browse })}
					aria-current={catalogSort === "popular" ? "page" : undefined}
					className={chipLink(catalogSort === "popular", false)}
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
