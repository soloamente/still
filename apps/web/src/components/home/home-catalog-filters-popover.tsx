"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import { cn } from "@still/ui/lib/utils";
import {
	cloneElement,
	type MouseEvent,
	type ReactElement,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { PlanFeatureGate } from "@/components/plans/plan-feature-gate";
import {
	FilterChipRow,
	filterChipBaseClass,
} from "@/components/ui/filter-chip-row";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	getAppMobileVaulServerSnapshot,
	getAppMobileVaulSnapshot,
	subscribeAppMobileVaul,
} from "@/lib/app-mobile-vaul";
import {
	catalogFiltersBodyClassName,
	catalogFiltersPopoverClassName,
	catalogFiltersQuietClassName,
	catalogFiltersSectionClassName,
	catalogFiltersSectionLabelClassName,
} from "@/lib/catalog-filters-popover-chrome";
import {
	type HomeCatalogFilters,
	hasActiveHomeCatalogFilters,
	mergeHomeCatalogFiltersIntoHref,
} from "@/lib/home-catalog-filters";
import type { HomeCatalogRun } from "@/lib/home-catalog-run";
import type { HomeVenue } from "@/lib/home-venue";
import { useCatalogTmdbLanguage } from "@/lib/use-catalog-tmdb-language";
import { useSearchDialogGenres } from "@/lib/use-search-dialog-genres";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

const MONETIZATION_OPTIONS = [
	{ id: "flatrate", label: "Subscription" },
	{ id: "rent", label: "Rent" },
	{ id: "buy", label: "Buy" },
	{ id: "free", label: "Free" },
	{ id: "ads", label: "Ads" },
] as const;

const VENUE_PICKER_OPTIONS = [
	{ id: "theaters" as const, label: "In theaters" },
	{ id: "streaming" as const, label: "At home" },
] as const;

const TV_RUN_PICKER_OPTIONS = [
	{ id: "ongoing" as const, label: "Ongoing" },
	{ id: "completed" as const, label: "Completed" },
	{ id: "upcoming" as const, label: "Upcoming" },
] as const;

type HomeCatalogFiltersTriggerElement = ReactElement<{
	onClick?: (event: MouseEvent<HTMLElement>) => void;
}>;

function sectionLabel(text: string) {
	return <p className={catalogFiltersSectionLabelClassName}>{text}</p>;
}

function genreChipClass(active: boolean) {
	return cn(
		filterChipBaseClass,
		"min-h-11 transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none",
		active
			? "bg-foreground text-background"
			: "bg-background text-muted-foreground [@media(hover:hover)]:hover:bg-foreground/10 [@media(hover:hover)]:hover:text-foreground",
	);
}

/** Scroll edge fades — matches `NotificationMenuScrims` on `bg-background`. */
function CatalogFiltersMenuScrims({
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

export type HomeCatalogFiltersPopoverProps = {
	browse: "movies" | "tv";
	venue: HomeVenue;
	filters: HomeCatalogFilters;
	summaryLabel: string;
	currentHref: string;
	onNavigate: (href: string) => void;
	onPrefetch?: (href: string) => void;
	trigger: HomeCatalogFiltersTriggerElement;
	/** TV **This season** already pins Animation — hide genre picks. */
	hideGenreFilter?: boolean;
	/** Mobile — In theaters / At home lives in this panel instead of a separate popover. */
	showVenuePicker?: boolean;
	onVenueChange?: (venue: HomeVenue) => void;
	/** Mobile TV — Ongoing / Completed / Upcoming in this panel instead of a separate popover. */
	showRunPicker?: boolean;
	catalogRun?: HomeCatalogRun;
	onRunChange?: (run: HomeCatalogRun) => void;
};

/**
 * In-lobby discover refinements — genre and watch type for Movies/TV browse.
 * Sort order stays on the left Popular · Latest · Upcoming rail.
 */
export function HomeCatalogFiltersPopover({
	browse,
	venue,
	filters,
	summaryLabel,
	currentHref,
	onNavigate,
	onPrefetch,
	trigger,
	hideGenreFilter = false,
	showVenuePicker = false,
	onVenueChange,
	showRunPicker = false,
	catalogRun = "ongoing",
	onRunChange,
}: HomeCatalogFiltersPopoverProps) {
	const [open, setOpen] = useState(false);
	const isMobileVaul = useSyncExternalStore(
		subscribeAppMobileVaul,
		getAppMobileVaulSnapshot,
		getAppMobileVaulServerSnapshot,
	);
	const scrollRef = useRef<HTMLDivElement>(null);
	const catalogLanguage = useCatalogTmdbLanguage(open);
	const {
		movieGenres,
		tvGenres,
		loading: genresLoading,
	} = useSearchDialogGenres(open, catalogLanguage);

	const showWatchType = venue === "streaming";
	const activeMonetization = filters.monetization ?? "flatrate";
	const genreOptions = browse === "tv" ? tvGenres : movieGenres;

	const navigateFilters = (next: HomeCatalogFilters) => {
		const href = mergeHomeCatalogFiltersIntoHref(currentHref, next);
		onNavigate(href);
		onPrefetch?.(href);
	};

	const sortedGenres = useMemo(
		() => [...genreOptions].sort((a, b) => a.name.localeCompare(b.name)),
		[genreOptions],
	);

	const scrollContentKey = `${browse}-${sortedGenres.length}-${showWatchType}-${genresLoading}-${hideGenreFilter ? "season" : "genre"}-${showVenuePicker ? venue : "no-venue"}-${showRunPicker ? catalogRun : "no-run"}`;
	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
		scrollContentKey,
	);

	const panelContent = (
		<div className="flex min-h-0 flex-col gap-3">
			<div className="flex shrink-0 flex-col gap-1 px-2 pt-1.5">
				<p className="text-balance font-semibold text-base text-foreground leading-snug">
					Filters
				</p>
				<p className={catalogFiltersBodyClassName}>{summaryLabel}</p>
			</div>

			<div className="relative min-h-0">
				<CatalogFiltersMenuScrims
					showHeaderFade={showHeaderFade}
					showFooterFade={showFooterFade}
				/>
				<div
					ref={scrollRef}
					className="scrollbar-none flex max-h-[min(56vh,26rem)] min-h-0 flex-col gap-2 overflow-y-auto overscroll-y-contain"
				>
					{showRunPicker && onRunChange ? (
						<div className={catalogFiltersSectionClassName}>
							{sectionLabel("Catalogue slice")}
							<SegmentedPillToolbar
								layoutId="home-catalog-filter-tv-run"
								aria-label="TV catalogue slice"
								value={
									catalogRun === "completed" || catalogRun === "upcoming"
										? catalogRun
										: "ongoing"
								}
								onChange={(next) => onRunChange(next)}
								options={TV_RUN_PICKER_OPTIONS}
								compact
							/>
						</div>
					) : null}

					{showVenuePicker && onVenueChange ? (
						<div className={catalogFiltersSectionClassName}>
							{sectionLabel("Release window")}
							<SegmentedPillToolbar
								layoutId={`home-catalog-filter-venue-${browse}`}
								aria-label="Release window"
								value={venue}
								onChange={(next) => onVenueChange(next)}
								options={VENUE_PICKER_OPTIONS}
								compact
							/>
						</div>
					) : null}

					{hideGenreFilter ? null : (
						<div className={catalogFiltersSectionClassName}>
							{sectionLabel("Genre")}
							<FilterChipRow aria-label="Genre" className="gap-1.5">
								<button
									type="button"
									className={genreChipClass(filters.genreId == null)}
									aria-pressed={filters.genreId == null}
									onClick={() => navigateFilters({ ...filters, genreId: null })}
								>
									All genres
								</button>
								{genresLoading ? (
									<>
										<span className="sr-only">Loading genres</span>
										<span className="inline-flex gap-1.5" aria-hidden>
											<span className="h-11 w-16 animate-pulse rounded-full bg-background" />
											<span className="h-11 w-20 animate-pulse rounded-full bg-background" />
										</span>
									</>
								) : null}
								{sortedGenres.map((genre) => {
									const active = filters.genreId === genre.id;
									return (
										<button
											key={genre.id}
											type="button"
											className={genreChipClass(active)}
											aria-pressed={active}
											onClick={() =>
												navigateFilters({
													...filters,
													genreId: active ? null : genre.id,
												})
											}
										>
											{genre.name}
										</button>
									);
								})}
							</FilterChipRow>
						</div>
					)}

					{showWatchType ? (
						<div className={catalogFiltersSectionClassName}>
							{sectionLabel("Watch type")}
							<PlanFeatureGate featureKey="streaming_filters">
								<SegmentedPillToolbar
									layoutId={`home-catalog-filter-monetization-${browse}`}
									aria-label="Watch type"
									value={activeMonetization}
									onChange={(next) =>
										navigateFilters({
											...filters,
											monetization: next === "flatrate" ? null : next,
										})
									}
									options={MONETIZATION_OPTIONS.map((opt) => ({
										id: opt.id,
										label: opt.label,
									}))}
									compact
								/>
							</PlanFeatureGate>
						</div>
					) : null}
				</div>
			</div>

			{hasActiveHomeCatalogFilters(filters) ? (
				<div className="flex shrink-0 justify-end px-1">
					<button
						type="button"
						className={catalogFiltersQuietClassName}
						onClick={() =>
							navigateFilters({
								genreId: null,
								monetization: null,
							})
						}
					>
						Clear filters
					</button>
				</div>
			) : null}
		</div>
	);

	if (isMobileVaul) {
		const mobileTrigger = cloneElement(trigger, {
			onClick: (event: MouseEvent<HTMLElement>) => {
				trigger.props.onClick?.(event);
				setOpen(true);
			},
		});
		return (
			<>
				{mobileTrigger}
				<DetailVaulSheet
					open={open}
					onOpenChange={setOpen}
					title="Filters"
					description={summaryLabel}
					appStack
				>
					<div className="rounded-[1.5rem] bg-background px-2 pt-2 pb-4">
						{panelContent}
					</div>
				</DetailVaulSheet>
			</>
		);
	}

	return (
		<Popover open={open} onOpenChange={setOpen} modal={false}>
			<PopoverTrigger render={trigger} />
			<PopoverContent
				side="bottom"
				align="end"
				sideOffset={12}
				initialFocus={false}
				className={catalogFiltersPopoverClassName}
			>
				{panelContent}
			</PopoverContent>
		</Popover>
	);
}
