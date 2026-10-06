"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { WATCHLIST_PROVIDER_PILL_SLOT_ID } from "@/components/watchlist/watchlist-lobby-filter-row";
import { useWatchlistLobbyParams } from "@/components/watchlist/watchlist-lobby-params-context";
import { WatchlistProviderCircleLogo } from "@/components/watchlist/watchlist-provider-circle-logo";
import { useWatchlistProviderFlyChrome } from "@/components/watchlist/watchlist-provider-fly-context";
import {
	resolveWatchlistProviderEntry,
	useWatchlistProvidersCatalog,
} from "@/components/watchlist/watchlist-providers-catalog-context";
import {
	catalogFiltersBodyClassName,
	catalogFiltersPopoverClassName,
	catalogFiltersQuietClassName,
} from "@/lib/catalog-filters-popover-chrome";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { watchlistPlatformPillLogoUrl } from "@/lib/watchlist-provider-logo-dev";
import { WATCHLIST_PROVIDER_PILL_MOTION } from "@/lib/watchlist-provider-pill-motion";

const MAX_STACKED_LOGOS = 4;

const managePillClassName = cn(
	"t-watchlist-provider-pill-trigger inline-flex min-h-11 w-full min-w-0 max-w-[min(14rem,42vw)] items-center gap-2 rounded-full bg-background py-1.5 pr-3 pl-1.5 text-left active:scale-[0.97] motion-reduce:transition-none",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
);

const panelActionClassName = cn(
	"inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-background px-3 font-medium text-foreground text-sm transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none",
	DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
);

function resolvePillSlot(): HTMLElement | null {
	if (typeof document === "undefined") return null;
	return document.getElementById(WATCHLIST_PROVIDER_PILL_SLOT_ID);
}

/** Composite AND-filter pill — stacked provider logos + manage popover. */
export function WatchlistProviderFilterPill() {
	const { landingProviderIds, pillDockPhase, pillLandBounceKey } =
		useWatchlistProviderFlyChrome();
	const { providers, removeProvider, clearProviders } =
		useWatchlistLobbyParams();
	const { providers: catalogue } = useWatchlistProvidersCatalog();
	const [slot, setSlot] = useState<HTMLElement | null>(resolvePillSlot);
	const [open, setOpen] = useState(false);
	const reduceMotion = useReducedMotion();

	const pillMotion = WATCHLIST_PROVIDER_PILL_MOTION;

	useLayoutEffect(() => {
		setSlot(resolvePillSlot());
	}, []);

	const selectedEntries = useMemo(
		() => providers.map((id) => resolveWatchlistProviderEntry(catalogue, id)),
		[catalogue, providers],
	);

	const label = useMemo(() => {
		if (selectedEntries.length === 0) return "";
		if (selectedEntries.length === 1) {
			return `Streaming filter: ${selectedEntries[0]?.providerName ?? "service"}`;
		}
		const names = selectedEntries
			.map((entry) => entry.providerName)
			.join(" and ");
		return `Streaming filter: ${names}`;
	}, [selectedEntries]);

	const labelText = selectedEntries
		.map((entry) => entry.providerName)
		.join(" · ");

	const isFlyDock = pillDockPhase === "compact";
	const logosSettling = landingProviderIds.size > 0;
	const shellKey = isFlyDock
		? "dock"
		: pillLandBounceKey > 0
			? `land-${pillLandBounceKey}`
			: "steady";

	const shellOpen = {
		scale: 1,
		opacity: 1,
		filter: "blur(0px)",
	};

	const shellFirstLandInitial = {
		scale: pillMotion.shell.closedScale,
		opacity: pillMotion.shell.closedOpacity,
		filter: `blur(${pillMotion.shell.closedBlur}px)`,
	};

	const shellLandBounceInitial = {
		scale: pillMotion.landBounceScale,
		opacity: 1,
		filter: "blur(0px)",
	};

	const shellLandInitial =
		pillLandBounceKey === 1 ? shellFirstLandInitial : shellLandBounceInitial;

	if (providers.length === 0 || slot == null) return null;

	const pill = (
		<div className="flex w-max min-w-0 shrink-0">
			<Popover open={open} onOpenChange={setOpen} modal={false}>
				<motion.div
					key={shellKey}
					className="t-watchlist-provider-pill-shell inline-flex min-w-0 max-w-[min(14rem,42vw)] shrink-0"
					style={{ transformOrigin: "center right" }}
					initial={
						!isFlyDock && pillLandBounceKey > 0 ? shellLandInitial : false
					}
					animate={shellOpen}
					transition={reduceMotion ? { duration: 0 } : pillMotion.spring}
				>
					<PopoverTrigger
						type="button"
						className={managePillClassName}
						aria-label={label}
						title={label}
					>
						<motion.span
							className="t-watchlist-provider-pill-logos flex shrink-0 items-center pl-0.5"
							animate={{
								filter: logosSettling
									? `blur(${pillMotion.stackBlurPx}px)`
									: "blur(0px)",
							}}
							transition={
								reduceMotion
									? { duration: 0 }
									: { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
							}
						>
							{selectedEntries
								.slice(0, MAX_STACKED_LOGOS)
								.map((entry, index) => {
									const logoSrc = watchlistPlatformPillLogoUrl(entry);
									return (
										<WatchlistProviderCircleLogo
											key={entry.providerId}
											src={logoSrc}
											name={entry.providerName}
											fallbackLabel={entry.providerName.slice(0, 1)}
											className={cn(
												"size-7 ring-2 ring-background transition-opacity duration-150 motion-reduce:transition-none",
												index > 0 && "-ml-2",
												landingProviderIds.has(entry.providerId) && "opacity-0",
											)}
											fallbackClassName="text-xs"
											style={{ zIndex: MAX_STACKED_LOGOS - index }}
											dataWatchlistLogo="pill"
											providerId={entry.providerId}
										/>
									);
								})}
							{selectedEntries.length > MAX_STACKED_LOGOS ? (
								<span className="relative -ml-2 inline-flex size-7 items-center justify-center rounded-full bg-card font-medium text-foreground text-xs ring-2 ring-background">
									+{selectedEntries.length - MAX_STACKED_LOGOS}
								</span>
							) : null}
						</motion.span>
						<span
							className={cn(
								"t-watchlist-provider-pill-body min-w-0 shrink",
								isFlyDock ? "is-compact" : "is-expanded",
							)}
						>
							<span className="t-watchlist-provider-pill-label min-w-0 truncate font-medium text-foreground text-sm">
								{labelText}
							</span>
						</span>
					</PopoverTrigger>
				</motion.div>
				<PopoverContent
					side="bottom"
					align="end"
					sideOffset={12}
					initialFocus={false}
					className={catalogFiltersPopoverClassName}
				>
					<div className="flex min-h-0 flex-col gap-3">
						<div className="flex flex-col gap-1 px-2 pt-1.5">
							<p className="text-balance font-semibold text-base text-foreground leading-snug">
								Streaming filter
							</p>
							<p className={catalogFiltersBodyClassName}>
								Titles must stream on every selected service in your region.
							</p>
						</div>
						<ul className="flex flex-col gap-2">
							{selectedEntries.map((entry) => {
								const logoSrc = watchlistPlatformPillLogoUrl(entry);
								return (
									<li
										key={entry.providerId}
										className="flex items-center gap-2 rounded-[1.25rem] bg-card py-2 pr-2 pl-2"
									>
										<WatchlistProviderCircleLogo
											src={logoSrc}
											name={entry.providerName}
											className="size-9"
										/>
										<span className="min-w-0 flex-1 truncate font-medium text-foreground text-sm">
											{entry.providerName}
										</span>
										<button
											type="button"
											className={panelActionClassName}
											onClick={() => {
												removeProvider(entry.providerId);
												if (providers.length <= 1) setOpen(false);
											}}
										>
											Remove
										</button>
									</li>
								);
							})}
						</ul>
						<div className="flex justify-end px-1">
							<button
								type="button"
								className={catalogFiltersQuietClassName}
								onClick={() => {
									clearProviders();
									setOpen(false);
								}}
							>
								Clear all
							</button>
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);

	return createPortal(pill, slot);
}
