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
import { CATALOG_WATCH_REGION_OPTIONS } from "@/lib/catalog-watch-region-options";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { HOME_LOBBY_FILTERS_TRIGGER_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import {
	type CatalogTmdbWatchRegionPref,
	readCatalogTmdbWatchRegionPref,
} from "@/lib/profile-preferences";
import { useSheetScrollFades } from "@/lib/use-sheet-scroll-fades";

type WatchlistFiltersTriggerElement = ReactElement<{
	onClick?: (event: MouseEvent<HTMLElement>) => void;
}>;

/** Footer pill — matches home catalog filters popover rhythm. */
const panelPillClassName = cn(
	"inline-flex min-h-10 items-center justify-center rounded-full bg-card px-4 py-2 font-medium text-muted-foreground text-sm transition-[transform,color] duration-200 ease-out active:scale-[0.96] motion-reduce:transition-none",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
);

function sectionLabel(text: string) {
	return (
		<p className="mb-2 px-0.5 font-medium text-muted-foreground text-xs tracking-wide">
			{text}
		</p>
	);
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
		regionPref === null
			? "Set your streaming region to rank what's on your services."
			: watchlistRegionGuidanceCopy(regionPref);

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
		<div className="flex min-h-0 flex-col gap-2">
			<div className="shrink-0 px-0.5">
				<p className="text-balance font-semibold text-base text-foreground leading-snug">
					Filters
				</p>
				<p className="mt-0.5 text-pretty text-muted-foreground text-sm leading-snug">
					Streaming region and alerts for your saves.
				</p>
			</div>

			<div className="relative min-h-0 overflow-hidden rounded-2xl">
				<WatchlistFiltersMenuScrims
					showHeaderFade={showHeaderFade}
					showFooterFade={showFooterFade}
				/>
				<div
					ref={scrollRef}
					className="scrollbar-none max-h-[min(56vh,26rem)] min-h-0 overflow-y-auto overscroll-y-contain px-0.5 py-0.5"
				>
					<div className="mb-4">
						{sectionLabel("Streaming region")}
						<p className="mb-3 text-pretty px-0.5 text-muted-foreground text-sm leading-relaxed">
							{regionLoading ? "Loading…" : guidance}
						</p>
						<p className="mb-3 px-0.5 font-medium text-foreground text-sm">
							{regionLoading ? "…" : regionLabel}
						</p>
						<WatchlistRegionAction className={panelPillClassName}>
							{regionPref === null ? "Set watch region" : "Change region"}
						</WatchlistRegionAction>
					</div>

					<div className="mb-4">
						{sectionLabel("What counts as streaming")}
						<p className="text-pretty px-0.5 text-muted-foreground text-sm leading-relaxed">
							Subscription services in your chosen region. Pick platforms from
							the row below to show saves that stream on{" "}
							<span className="text-foreground">every</span> service you select.
						</p>
					</div>

					<div className="mb-1">
						{sectionLabel("Watchlist alerts")}
						<PlanFeatureGate featureKey="watchlist_alerts">
							<p className="text-pretty px-0.5 text-muted-foreground text-sm leading-relaxed">
								Per-title alerts on posters notify you when a save starts
								streaming in your region. Manage defaults in{" "}
								<Link
									href="/me/settings"
									className="font-medium text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
								>
									Settings
								</Link>
								.
							</p>
						</PlanFeatureGate>
					</div>
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
					<div className="px-4 pb-6">{panelContent}</div>
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
				className="w-[min(100vw-1.5rem,22rem)] overflow-visible rounded-[1.75rem] p-3 shadow-mobbin-xl"
			>
				{panelContent}
			</PopoverContent>
		</Popover>
	);
}
