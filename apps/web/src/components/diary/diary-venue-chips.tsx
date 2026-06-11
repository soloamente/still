"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import IconSlider from "@still/ui/icons/slider";
import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { useDiaryLobbyParams } from "@/components/diary/diary-lobby-params-context";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { discoverCatalogUrl } from "@/lib/discover-catalog-url";
import {
	HOME_LOBBY_CHIP_BUTTON_CLASSNAME,
	HOME_LOBBY_CHIP_TRACK_CLASSNAME,
	HOME_LOBBY_FILTERS_TRIGGER_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import type { HomeVenue } from "@/lib/home-venue";

const DIARY_VENUE_PICKER_OPTIONS = [
	{ id: "theaters" as const, label: "In cinemas" },
	{ id: "streaming" as const, label: "At home" },
] as const;

/**
 * `/diary` right rail — **In cinemas / At home** + filters shortcut.
 * Venue uses instant `selectVenue`; filters stay a normal route link.
 */
export function DiaryVenueChips() {
	const { venue, selectVenue } = useDiaryLobbyParams();
	const [open, setOpen] = useState(false);
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

	const theatersActive = venue === "theaters";
	const streamingActive = venue === "streaming";
	const venueLabel = theatersActive ? "In cinemas" : "At home";

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

	const handleVenueChange = (next: HomeVenue) => {
		selectVenue(next);
	};

	return (
		<div className="shrink-0">
			<p id={toolbarDescId} className="sr-only">
				On your diary, In cinemas vs At home sets which catalogue slice the
				filters button opens; your logged films list is ordered by the left
				chips.
			</p>

			{/* Mobile — venue inside filters panel */}
			<div
				className={cn(HOME_LOBBY_CHIP_TRACK_CLASSNAME, "sm:hidden")}
				role="toolbar"
				aria-label="Release window and filters"
				aria-describedby={toolbarDescId}
			>
				<Popover open={open} onOpenChange={setOpen} modal={false}>
					<PopoverTrigger
						type="button"
						className={HOME_LOBBY_FILTERS_TRIGGER_CLASSNAME}
						aria-label={`Diary filters — ${venueLabel}`}
						title={`Diary filters — ${venueLabel}`}
					>
						<IconSlider
							size="1.125rem"
							className="shrink-0 opacity-95"
							aria-hidden
						/>
					</PopoverTrigger>
					<PopoverContent
						side="bottom"
						align="end"
						sideOffset={12}
						initialFocus={false}
						className="w-[min(100vw-1.5rem,22rem)] overflow-visible rounded-[1.75rem] p-3 shadow-mobbin-xl"
					>
						<div className="flex min-h-0 flex-col gap-3">
							<div className="shrink-0 px-0.5">
								<p className="text-balance font-semibold text-base text-foreground leading-snug">
									Filters
								</p>
								<p className="mt-0.5 text-pretty text-muted-foreground text-sm leading-snug">
									{venueLabel}
								</p>
							</div>
							<div>
								<p className="mb-2 px-0.5 font-medium text-muted-foreground text-xs tracking-wide">
									Release window
								</p>
								<SegmentedPillToolbar
									layoutId="diary-catalog-view-mode-pill-mobile"
									aria-label="Release window"
									compact
									value={venue}
									onChange={handleVenueChange}
									options={DIARY_VENUE_PICKER_OPTIONS}
								/>
							</div>
							<div className="flex shrink-0 justify-end px-0.5">
								<Link
									href={filtersHref}
									className={cn(
										HOME_LOBBY_CHIP_BUTTON_CLASSNAME,
										"bg-card text-foreground",
										"transition-[transform,color] duration-200 ease-out active:scale-[0.96] motion-reduce:transition-none",
									)}
									onClick={() => setOpen(false)}
								>
									Browse catalogue
								</Link>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			</div>

			{/* Desktop — inline venue rail + discover link */}
			<div
				className={cn(HOME_LOBBY_CHIP_TRACK_CLASSNAME, "hidden sm:flex")}
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
					className={HOME_LOBBY_FILTERS_TRIGGER_CLASSNAME}
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
