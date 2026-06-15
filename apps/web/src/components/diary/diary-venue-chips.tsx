"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import IconSlider from "@still/ui/icons/slider";
import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";

import { useDiaryLobbyParams } from "@/components/diary/diary-lobby-params-context";
import { DiaryWatchPeriodPicker } from "@/components/diary/diary-watch-period-picker";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { formatDiaryDecadeLabel } from "@/lib/diary-lobby-order";
import {
	HOME_LOBBY_CHIP_BUTTON_CLASSNAME,
	HOME_LOBBY_CHIP_TRACK_CLASSNAME,
	HOME_LOBBY_FILTERS_TRIGGER_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import type { HomeVenue } from "@/lib/home-venue";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

const DIARY_VENUE_PICKER_OPTIONS = [
	{ id: "theaters" as const, label: "In cinemas" },
	{ id: "streaming" as const, label: "At home" },
] as const;

function sectionLabel(text: string) {
	return (
		<p className="mb-2 px-0.5 font-medium text-muted-foreground text-xs tracking-wide">
			{text}
		</p>
	);
}

function diaryFiltersSummaryLabel(
	venue: HomeVenue,
	year: number | null,
	decade: number | null,
): string {
	const venueLabel = venue === "theaters" ? "In cinemas" : "At home";
	if (year != null) return `${venueLabel} · ${year}`;
	if (decade != null)
		return `${venueLabel} · ${formatDiaryDecadeLabel(decade)}`;
	return venueLabel;
}

function DiaryFiltersMenuScrims({
	showHeaderFade,
	showFooterFade,
}: {
	showHeaderFade: boolean;
	showFooterFade: boolean;
}) {
	return (
		<>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-linear-to-b from-25% from-background via-background/40 to-background/0 transition-opacity duration-200 motion-reduce:transition-none",
					showHeaderFade ? "opacity-100" : "opacity-0",
				)}
			/>
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-linear-to-t from-15% from-background via-background/35 to-background/0 transition-opacity duration-200 motion-reduce:transition-none",
					showFooterFade ? "opacity-100" : "opacity-0",
				)}
			/>
		</>
	);
}

/**
 * `/diary` right rail — **In cinemas / At home** + filters popover (venue on
 * mobile, watch year/decade). Venue uses instant `selectVenue` on desktop.
 */
export function DiaryVenueChips() {
	const { venue, year, decade, selectVenue, watchPeriods } =
		useDiaryLobbyParams();
	const [open, setOpen] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
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
	const summaryLabel = diaryFiltersSummaryLabel(venue, year, decade);
	const filtersAria = `Diary filters — ${summaryLabel}`;

	const toolbarDescId = "diary-catalog-view-mode-desc";
	const scrollContentKey = `${venue}-${year ?? ""}-${decade ?? ""}-${watchPeriods.years.length}`;
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
		scrollContentKey,
	);

	const handleVenueChange = (next: HomeVenue) => {
		selectVenue(next);
	};

	const filtersPopoverPanel = (
		<PopoverContent
			side="bottom"
			align="end"
			sideOffset={12}
			initialFocus={false}
			className="w-[min(100vw-1.5rem,22rem)] overflow-visible rounded-[1.75rem] p-3 shadow-mobbin-xl"
		>
			<div className="flex min-h-0 flex-col gap-2">
				<div className="shrink-0 px-0.5">
					<p className="text-balance font-semibold text-base text-foreground leading-snug">
						Filters
					</p>
					<p className="mt-0.5 text-pretty text-muted-foreground text-sm leading-snug">
						{summaryLabel}
					</p>
				</div>

				<div className="relative min-h-0 overflow-hidden rounded-2xl">
					<DiaryFiltersMenuScrims
						showHeaderFade={showHeaderFade}
						showFooterFade={showFooterFade}
					/>
					<div
						ref={scrollRef}
						className="scrollbar-none max-h-[min(56vh,26rem)] min-h-0 overflow-y-auto overscroll-y-contain px-0.5 py-0.5"
						data-lenis-prevent-wheel
					>
						{/* Mobile only — desktop patrons use the inline In cinemas / At home chips. */}
						<div className="mb-4 sm:hidden">
							{sectionLabel("Release window")}
							<SegmentedPillToolbar
								layoutId="diary-catalog-view-mode-pill-mobile"
								aria-label="Release window"
								compact
								value={venue}
								onChange={handleVenueChange}
								options={DIARY_VENUE_PICKER_OPTIONS}
							/>
						</div>
						<DiaryWatchPeriodPicker />
					</div>
				</div>
			</div>
		</PopoverContent>
	);

	return (
		<div className="shrink-0">
			<p id={toolbarDescId} className="sr-only">
				On your diary, open filters to set release window and filter by when you
				watched each title. Your logged films list is ordered by the left chips.
			</p>

			{/* One popover + one trigger — avoids duplicate panels when mobile/desktop trees both mount. */}
			<Popover open={open} onOpenChange={setOpen} modal={false}>
				<div
					className={cn(HOME_LOBBY_CHIP_TRACK_CLASSNAME, "flex")}
					role="toolbar"
					aria-label="Release window and filters"
					aria-describedby={toolbarDescId}
				>
					<div className="hidden min-w-0 sm:flex">
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
						className="mx-1 hidden h-6 w-px shrink-0 self-center bg-border/55 sm:block"
					/>

					<PopoverTrigger
						type="button"
						className={HOME_LOBBY_FILTERS_TRIGGER_CLASSNAME}
						aria-label={filtersAria}
						title={filtersAria}
					>
						<IconSlider
							size="1.125rem"
							className="shrink-0 opacity-95"
							aria-hidden
						/>
					</PopoverTrigger>
				</div>
				{filtersPopoverPanel}
			</Popover>
		</div>
	);
}
