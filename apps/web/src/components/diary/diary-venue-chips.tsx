"use client";

import IconSlider from "@still/ui/icons/slider";
import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import { useDiaryLobbyParams } from "@/components/diary/diary-lobby-params-context";
import { discoverCatalogUrl } from "@/lib/discover-catalog-url";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";

/**
 * `/diary` right rail — **In cinemas / At home** + filters shortcut.
 * Venue uses instant `selectVenue`; filters stay a normal route link.
 */
export function DiaryVenueChips() {
	const { venue, selectVenue } = useDiaryLobbyParams();
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
			"relative inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-5 py-2.5 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const theatersActive = venue === "theaters";
	const streamingActive = venue === "streaming";

	const filtersHref =
		venue === "theaters"
			? buildHomeLobbyHref({
					browse: "movies",
					sort: "popular",
					venue: "theaters",
				})
			: discoverCatalogUrl({
					sort: "popularity.desc",
					monetization: "flatrate",
				});

	const filtersAria =
		venue === "theaters"
			? "Filters — films currently in theatres on the home movies lobby"
			: "Filters — popular titles with subscription streaming at home in the catalogue region";

	const toolbarDescId = "diary-catalog-view-mode-desc";

	return (
		<div className="flex shrink-0 flex-col items-end gap-1">
			<p id={toolbarDescId} className="sr-only">
				On your diary, In cinemas vs At home sets which catalogue slice the
				filters button opens; your logged films list is ordered by the left
				chips.
			</p>
			<div
				className="flex w-fit items-center rounded-full bg-background p-1"
				role="toolbar"
				aria-label="Release window and filters"
				aria-describedby={toolbarDescId}
			>
				<div className="flex min-w-0">
					<button
						type="button"
						aria-current={theatersActive ? "page" : undefined}
						className={chipButton(theatersActive)}
						title="Emphasise in-cinema context for filters and browse"
						aria-label="In cinemas — stay on diary"
						onClick={() => selectVenue("theaters")}
					>
						{theatersActive ? (
							<motion.span
								className="absolute inset-0 z-0 rounded-full bg-card"
								layoutId="diary-catalog-view-mode-pill"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">In cinemas</span>
					</button>
					<button
						type="button"
						aria-current={streamingActive ? "page" : undefined}
						className={chipButton(streamingActive)}
						title="Emphasise at-home streaming context for filters and browse"
						aria-label="At home — stay on diary"
						onClick={() => selectVenue("streaming")}
					>
						{streamingActive ? (
							<motion.span
								className="absolute inset-0 z-0 rounded-full bg-card"
								layoutId="diary-catalog-view-mode-pill"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">At home</span>
					</button>
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
