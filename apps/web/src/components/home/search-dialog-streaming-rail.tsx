"use client";

import { Tooltip, TooltipTrigger } from "@still/ui/components/tooltip";
import IconEarthPinFill from "@still/ui/icons/earth-pin-fill";
import { cn } from "@still/ui/lib/utils";
import type { CSSProperties } from "react";
import { SearchDialogHorizontalRail } from "@/components/home/search-dialog-horizontal-rail";

import { SearchDialogKeyboardFocusWrap } from "@/components/home/search-dialog-keyboard-focus-wrap";
import {
	COUNTRY_FLAG_RIM_SHADOW,
	CountryFlagIcon,
} from "@/components/ui/country-flag-icon";
import { WatchlistProviderCircleLogo } from "@/components/watchlist/watchlist-provider-circle-logo";
import {
	CatalogSearchTooltipContent,
	SearchDialogRailTooltipProvider,
} from "@/lib/catalog-search-tooltip-portal";
import type { SearchDialogStreamingProvider } from "@/lib/search-dialog-streaming-providers";

/** Matches `size-3.5` — shared by the rim badge and the logo cutout. */
const STREAMING_REGION_FLAG_SIZE = "0.875rem";

/** Circle chip — provider mark fills the full 56×56 tap target. */
const STREAMING_RAIL_CHIP_CLASS =
	"relative size-14 shrink-0 overflow-visible rounded-full p-0";

/** Fixed skeleton slots — stable keys without array index. */
const STREAMING_RAIL_SKELETON_SLOT_IDS = [
	"slot-a",
	"slot-b",
	"slot-c",
	"slot-d",
	"slot-e",
	"slot-f",
	"slot-g",
	"slot-h",
] as const;

/** Square bottom-right notch (same footprint as the flag badge, not a circle). */
const STREAMING_LOGO_REGION_NOTCH_MASK =
	"[-webkit-mask-image:linear-gradient(#000_0_0),linear-gradient(#000_0_0)] [mask-image:linear-gradient(#000_0_0),linear-gradient(#000_0_0)] [mask-size:100%_100%,var(--streaming-region-flag-size)_var(--streaming-region-flag-size)] [mask-position:0_0,100%_100%] [mask-repeat:no-repeat] [-webkit-mask-composite:xor] [mask-composite:exclude]";

const STREAMING_REGION_BADGE_CLASS =
	"pointer-events-none absolute right-0 bottom-0 z-10 inline-flex size-3.5 shrink-0 overflow-hidden rounded-[3px] bg-card";

function streamingRegionAriaLabel(regionIso: string | null): string {
	if (!regionIso) return "your region";
	if (regionIso === "ALL") return "all countries";
	try {
		const name = new Intl.DisplayNames(["en"], { type: "region" }).of(
			regionIso,
		);
		return name ?? regionIso;
	} catch {
		return regionIso;
	}
}

function StreamingRegionRimBadge({ regionIso }: { regionIso: string }) {
	if (regionIso === "ALL") {
		return (
			<span
				className={cn(
					STREAMING_REGION_BADGE_CLASS,
					"items-center justify-center text-muted-foreground",
					COUNTRY_FLAG_RIM_SHADOW,
				)}
				aria-hidden
			>
				<IconEarthPinFill className="size-2.5" aria-hidden />
			</span>
		);
	}
	return (
		<span
			className={cn(STREAMING_REGION_BADGE_CLASS, COUNTRY_FLAG_RIM_SHADOW)}
			aria-hidden
		>
			<CountryFlagIcon
				countryCode={regionIso}
				size={14}
				className="size-full rounded-[3px]"
			/>
		</span>
	);
}

/**
 * Flatrate platforms in the patron watch region — pick one to filter discover results.
 */
export function SearchDialogStreamingRail({
	providers,
	selectedProviderId,
	onSelectProvider,
	loading,
	regionIso,
	keyboardFocusedIndex = null,
	resultIndexBase = 0,
}: {
	providers: SearchDialogStreamingProvider[];
	selectedProviderId: number | null;
	onSelectProvider: (providerId: number | null) => void;
	loading: boolean;
	/** Patron catalogue watch region — ISO 3166-1 alpha-2 or `ALL`. */
	regionIso: string | null;
	keyboardFocusedIndex?: number | null;
	resultIndexBase?: number;
}) {
	const railEnabled = loading || providers.length > 0;
	if (!loading && providers.length === 0) return null;

	const regionLabel = streamingRegionAriaLabel(regionIso);
	const showRegionBadge = Boolean(regionIso);
	const railContentKey = [
		loading ? "loading" : "ready",
		regionIso ?? "none",
		selectedProviderId ?? "all",
		providers.map((p) => p.id).join(","),
	].join("\0");

	return (
		<SearchDialogHorizontalRail
			label="Streaming platforms in your watch region"
			contentKey={railContentKey}
			enabled={railEnabled}
		>
			<SearchDialogRailTooltipProvider>
				{loading
					? STREAMING_RAIL_SKELETON_SLOT_IDS.map((slotId) => (
							<div
								key={slotId}
								className={cn(
									STREAMING_RAIL_CHIP_CLASS,
									"animate-pulse overflow-hidden rounded-full bg-muted/40",
								)}
							/>
						))
					: providers.map((provider, index) => {
							const resultIndex = resultIndexBase + index;
							const keyboardFocused = keyboardFocusedIndex === resultIndex;
							const selected = selectedProviderId === provider.id;
							const logoUrl = provider.logoUrl;
							return (
								<Tooltip key={provider.id}>
									<TooltipTrigger
										render={
											<SearchDialogKeyboardFocusWrap
												focused={keyboardFocused}
												className="rounded-full"
											>
												<button
													type="button"
													data-search-dialog-result-index={resultIndex}
													aria-label={`${provider.name} on ${regionLabel}`}
													aria-pressed={selected}
													onClick={() =>
														onSelectProvider(selected ? null : provider.id)
													}
													className={cn(
														STREAMING_RAIL_CHIP_CLASS,
														"inline-flex bg-card transition-[transform,opacity] duration-200 ease-out active:scale-[0.96] motion-reduce:transition-none",
														selected &&
															!keyboardFocused &&
															"ring-2 ring-foreground/25 ring-inset",
													)}
													style={
														showRegionBadge
															? ({
																	"--streaming-region-flag-size":
																		STREAMING_REGION_FLAG_SIZE,
																} as CSSProperties)
															: undefined
													}
												>
													<span
														className={cn(
															"block size-full overflow-hidden rounded-full",
															showRegionBadge &&
																STREAMING_LOGO_REGION_NOTCH_MASK,
														)}
													>
														<WatchlistProviderCircleLogo
															src={logoUrl}
															name={provider.name}
															className="size-full"
															providerId={provider.id}
														/>
													</span>
													{showRegionBadge && regionIso ? (
														<StreamingRegionRimBadge regionIso={regionIso} />
													) : null}
												</button>
											</SearchDialogKeyboardFocusWrap>
										}
									/>
									<CatalogSearchTooltipContent side="top">
										{provider.name}
									</CatalogSearchTooltipContent>
								</Tooltip>
							);
						})}
			</SearchDialogRailTooltipProvider>
		</SearchDialogHorizontalRail>
	);
}
