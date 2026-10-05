"use client";

import { Tooltip, TooltipTrigger } from "@still/ui/components/tooltip";
import { cn } from "@still/ui/lib/utils";
import { useRef } from "react";
import { SearchDialogHorizontalScrollEdges } from "@/components/home/search-dialog-horizontal-scroll-edges";
import { SearchDialogKeyboardFocusWrap } from "@/components/home/search-dialog-keyboard-focus-wrap";
import { SearchDialogStudioRailSkeleton } from "@/components/home/search-dialog-result-skeletons";
import { SearchDialogStudioLogo } from "@/components/home/search-dialog-studio-logo";
import {
	CatalogSearchTooltipContent,
	SearchDialogRailTooltipProvider,
} from "@/lib/catalog-search-tooltip-portal";
import { searchDialogStudioHasLogo } from "@/lib/search-dialog-studio-logo";
import {
	SEARCH_DIALOG_STUDIO_LOGO_CHIP_CLASS,
	SEARCH_DIALOG_STUDIO_RAIL_CHIP_CLASS,
	type SearchDialogStudio,
	studioShortName,
} from "@/lib/search-dialog-studios";
import {
	HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
	useHorizontalScrollFades,
} from "@/lib/use-horizontal-scroll-fades";

function studioChipClass(selected: boolean, showsLogo: boolean) {
	return cn(
		"inline-flex shrink-0 items-center justify-center overflow-hidden",
		SEARCH_DIALOG_STUDIO_RAIL_CHIP_CLASS,
		!showsLogo && SEARCH_DIALOG_STUDIO_LOGO_CHIP_CLASS,
		showsLogo && "p-0",
		selected ? "opacity-100" : "opacity-90",
	);
}

/**
 * Horizontal studio logos above the Popular preview column (Movies + TV browse).
 */
export function SearchDialogStudioRail({
	studios,
	selectedStudioId,
	onSelectStudio,
	loading,
	listingKind = "movie",
	keyboardFocusedIndex = null,
	resultIndexBase = 0,
}: {
	studios: SearchDialogStudio[];
	selectedStudioId: number | null;
	onSelectStudio: (id: number | null) => void;
	loading?: boolean;
	listingKind?: "movie" | "tv";
	keyboardFocusedIndex?: number | null;
	resultIndexBase?: number;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const railContentKey = [
		loading ? "loading" : "ready",
		selectedStudioId ?? "all",
		studios.map((studio) => studio.id).join(","),
	].join("\0");
	const railEnabled = loading || studios.length > 0;
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		scrollRef,
		railEnabled,
		railContentKey,
	);

	if (!loading && studios.length === 0) return null;

	const catalogueLabel = listingKind === "tv" ? "shows" : "films";

	return (
		<div className="min-w-0">
			{/* Fade scrims hide the horizontal clip; Lenis ignores wheel on this rail. */}
			<div className="relative w-full min-w-0 overflow-x-clip overflow-y-visible">
				<SearchDialogRailTooltipProvider>
					<div
						ref={scrollRef}
						data-lenis-prevent-wheel
						className={cn(
							HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
							"relative z-0 items-center overflow-y-visible pb-0",
						)}
						role="toolbar"
						aria-label="Filter by production company"
					>
						<div className="flex w-max flex-nowrap items-center gap-2.5">
							{loading ? <SearchDialogStudioRailSkeleton /> : null}
							{studios.map((studio, index) => {
								const resultIndex = resultIndexBase + index;
								const keyboardFocused = keyboardFocusedIndex === resultIndex;
								const selected = selectedStudioId === studio.id;
								const short = studioShortName(studio.name);
								const showsLogo = searchDialogStudioHasLogo(
									studio.id,
									studio.logoUrl,
									studio.name,
								);
								return (
									<Tooltip key={studio.id}>
										<TooltipTrigger
											render={
												<SearchDialogKeyboardFocusWrap
													focused={keyboardFocused}
													className="rounded-2xl"
												>
													<button
														type="button"
														data-search-dialog-result-index={resultIndex}
														aria-pressed={selected}
														aria-label={`${studio.name} ${catalogueLabel}`}
														onClick={() =>
															onSelectStudio(selected ? null : studio.id)
														}
														className={studioChipClass(selected, showsLogo)}
													>
														{showsLogo ? (
															<SearchDialogStudioLogo
																studioId={studio.id}
																studioName={studio.name}
																fallbackLogoUrl={studio.logoUrl}
																variant="rail"
															/>
														) : (
															<span className="px-1 font-semibold text-[9px] uppercase tracking-wide">
																{short.slice(0, 4)}
															</span>
														)}
													</button>
												</SearchDialogKeyboardFocusWrap>
											}
										/>
										<CatalogSearchTooltipContent side="top">
											{studio.name}
										</CatalogSearchTooltipContent>
									</Tooltip>
								);
							})}
						</div>
					</div>
				</SearchDialogRailTooltipProvider>
				<SearchDialogHorizontalScrollEdges
					showStartFade={showStartFade}
					showEndFade={showEndFade}
					tint="background"
				/>
			</div>
		</div>
	);
}
