"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import IconSlider from "@still/ui/icons/slider";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import {
	cloneElement,
	type MouseEvent,
	type ReactElement,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";

import { DetailVaulSheet } from "@/components/movie/detail-vaul-sheet";
import { PlanFeatureGate } from "@/components/plans/plan-feature-gate";
import {
	WatchlistRegionAction,
	watchlistRegionGuidanceCopy,
} from "@/components/watchlist/watchlist-region-action";
import { api } from "@/lib/api";
import {
	getAppMobileVaulServerSnapshot,
	getAppMobileVaulSnapshot,
	subscribeAppMobileVaul,
} from "@/lib/app-mobile-vaul";
import {
	catalogFiltersBodyClassName,
	catalogFiltersPopoverClassName,
	catalogFiltersPrimaryClassName,
	catalogFiltersSectionClassName,
	catalogFiltersSectionLabelClassName,
} from "@/lib/catalog-filters-popover-chrome";
import { CATALOG_WATCH_REGION_OPTIONS } from "@/lib/catalog-watch-region-options";
import { HOME_LOBBY_FILTERS_TRIGGER_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import {
	type CatalogTmdbWatchRegionPref,
	readCatalogTmdbWatchRegionPref,
} from "@/lib/profile-preferences";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

type WatchlistFiltersTriggerElement = ReactElement<{
	onClick?: (event: MouseEvent<HTMLElement>) => void;
}>;

function sectionLabel(text: string) {
	return <p className={catalogFiltersSectionLabelClassName}>{text}</p>;
}

function regionDisplayLabel(pref: CatalogTmdbWatchRegionPref): string {
	if (pref === null) return "Not set";
	if (pref === "ALL") return "All countries";
	return (
		CATALOG_WATCH_REGION_OPTIONS.find((option) => option.value === pref)
			?.label ?? pref
	);
}

/** Scroll edge fades on `bg-background` panel inset. */
function WatchlistFiltersMenuScrims({
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

export type WatchlistCatalogFiltersPopoverProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/**
 * Watchlist lobby filters — streaming region + availability copy + alerts hint.
 * Platform pickers live in the logo row (Task 7); this panel mirrors `/home` filters idiom.
 */
export function WatchlistCatalogFiltersPopover({
	open,
	onOpenChange,
}: WatchlistCatalogFiltersPopoverProps) {
	const isMobileVaul = useSyncExternalStore(
		subscribeAppMobileVaul,
		getAppMobileVaulSnapshot,
		getAppMobileVaulServerSnapshot,
	);
	const scrollRef = useRef<HTMLDivElement>(null);
	const [regionPref, setRegionPref] =
		useState<CatalogTmdbWatchRegionPref>(null);
	const [regionLoading, setRegionLoading] = useState(false);

	// Load the patron's saved region when the panel opens (no extra fetch on every lobby paint).
	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		setRegionLoading(true);
		void api.api.profiles.me
			.get()
			.then((res) => {
				if (cancelled) return;
				setRegionPref(
					readCatalogTmdbWatchRegionPref(res.data?.preferences ?? null),
				);
			})
			.finally(() => {
				if (!cancelled) setRegionLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open]);

	const regionLabel = regionDisplayLabel(regionPref);
	const guidance =
		regionPref === null || regionPref === "ALL"
			? watchlistRegionGuidanceCopy(regionPref)
			: "Availability and alerts use this region.";

	const { showHeaderFade, showFooterFade } = useSheetScrollFades(
		scrollRef,
		open,
		`${regionLabel}-${regionLoading}`,
	);

	const trigger: WatchlistFiltersTriggerElement = (
		<button
			type="button"
			className={HOME_LOBBY_FILTERS_TRIGGER_CLASSNAME}
			aria-label={`Watchlist filters — ${regionLabel}`}
			title={`Watchlist filters — ${regionLabel}`}
		>
			<IconSlider size="1.125rem" className="shrink-0 opacity-95" aria-hidden />
		</button>
	);

	const panelContent = (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex shrink-0 flex-col gap-1 px-2 pt-1.5">
				<p className="text-balance font-semibold text-base text-foreground leading-snug">
					Filters
				</p>
				<p className={catalogFiltersBodyClassName}>
					Region and alerts for your saves.
				</p>
			</div>

			<div className="relative flex min-h-0 flex-1 flex-col">
				<WatchlistFiltersMenuScrims
					showHeaderFade={showHeaderFade}
					showFooterFade={showFooterFade}
				/>
				<div
					ref={scrollRef}
					className="scrollbar-none flex max-h-[min(56vh,26rem)] min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain"
				>
					<section className={catalogFiltersSectionClassName}>
						{sectionLabel("Streaming region")}
						{regionLoading ? (
							<span
								className="h-5 w-24 animate-pulse rounded-full bg-background"
								aria-hidden
							/>
						) : (
							<p className="font-medium text-foreground text-sm">
								{regionLabel}
							</p>
						)}
						<p className={catalogFiltersBodyClassName}>
							{regionLoading ? "Checking your region." : guidance}
						</p>
						<WatchlistRegionAction className={catalogFiltersPrimaryClassName}>
							{regionPref === null ? "Set watch region" : "Change region"}
						</WatchlistRegionAction>
					</section>

					<section className={catalogFiltersSectionClassName}>
						{sectionLabel("What counts as streaming")}
						<p className={catalogFiltersBodyClassName}>
							Subscription services in your region. A title stays when it
							streams on every service you pick.
						</p>
					</section>

					<section className={catalogFiltersSectionClassName}>
						{sectionLabel("Watchlist alerts")}
						<PlanFeatureGate featureKey="watchlist_alerts">
							<p className={catalogFiltersBodyClassName}>
								Turn on an alert on a poster when you want to know that save has
								started streaming. Defaults live in{" "}
								<Link
									href="/me/settings"
									className="font-medium text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
								>
									Settings
								</Link>
								.
							</p>
						</PlanFeatureGate>
					</section>
				</div>
			</div>
		</div>
	);

	if (isMobileVaul) {
		const mobileTrigger = cloneElement(trigger, {
			onClick: (event: MouseEvent<HTMLElement>) => {
				trigger.props.onClick?.(event);
				onOpenChange(true);
			},
		});
		return (
			<>
				{mobileTrigger}
				<DetailVaulSheet
					open={open}
					onOpenChange={onOpenChange}
					title="Filters"
					description="Streaming region and alerts for your saves."
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
		<Popover open={open} onOpenChange={onOpenChange} modal={false}>
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
