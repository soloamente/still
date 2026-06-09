"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
import { cn } from "@still/ui/lib/utils";
import { useRef } from "react";
import { SearchDialogStudioRailSkeleton } from "@/components/home/search-dialog-result-skeletons";
import { SearchDialogStudioLogo } from "@/components/home/search-dialog-studio-logo";
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
		"inline-flex shrink-0 items-center justify-center overflow-hidden transition-[opacity,background-color,color] duration-200 ease-out motion-reduce:transition-none",
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
}: {
	studios: SearchDialogStudio[];
	selectedStudioId: number | null;
	onSelectStudio: (id: number | null) => void;
	loading?: boolean;
	listingKind?: "movie" | "tv";
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
		<div className="mb-4 min-w-0">
			<div className="mb-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
				Studios
			</div>
			{/* Fade scrims hide the horizontal clip; Lenis ignores wheel on this rail. */}
			<div className="relative w-full min-w-0 overflow-hidden">
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-card via-card/80 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
						showStartFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-card via-card/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
						showEndFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<TooltipProvider delay={280} closeDelay={80}>
					<div
						ref={scrollRef}
						data-lenis-prevent-wheel
						className={cn(
							HORIZONTAL_OVERFLOW_RAIL_CLASSNAME,
							"items-center gap-3 pb-0.5",
						)}
						role="toolbar"
						aria-label="Filter by production company"
					>
						{loading ? <SearchDialogStudioRailSkeleton /> : null}
						{studios.map((studio) => {
							const selected = selectedStudioId === studio.id;
							const short = studioShortName(studio.name);
							const showsLogo = searchDialogStudioHasLogo(
								studio.id,
								studio.logoUrl,
							);
							return (
								<Tooltip key={studio.id}>
									<TooltipTrigger
										render={
											<button
												type="button"
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
														fallbackLogoUrl={studio.logoUrl}
														variant="rail"
													/>
												) : (
													<span className="px-1 font-semibold text-[9px] uppercase tracking-wide">
														{short.slice(0, 4)}
													</span>
												)}
											</button>
										}
									/>
									<TooltipContent side="top">{studio.name}</TooltipContent>
								</Tooltip>
							);
						})}
					</div>
				</TooltipProvider>
			</div>
		</div>
	);
}
