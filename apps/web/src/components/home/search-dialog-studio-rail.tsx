"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
import { cn } from "@still/ui/lib/utils";
import Image from "next/image";

import { SearchDialogStudioRailSkeleton } from "@/components/home/search-dialog-result-skeletons";
import {
	SEARCH_DIALOG_STUDIO_LOGO_CHIP_CLASS,
	type SearchDialogStudio,
	studioShortName,
} from "@/lib/search-dialog-studios";

function studioChipClass(selected: boolean) {
	return cn(
		"inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl transition-[opacity,background-color,color] duration-200 ease-out motion-reduce:transition-none",
		SEARCH_DIALOG_STUDIO_LOGO_CHIP_CLASS,
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
	if (!loading && studios.length === 0) return null;

	const catalogueLabel = listingKind === "tv" ? "shows" : "films";

	return (
		<div className="mb-4 min-w-0 overflow-x-hidden">
			<div className="mb-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
				Studios
			</div>
			<TooltipProvider delay={280} closeDelay={80}>
				<div
					className="scrollbar-none flex flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain pb-0.5"
					role="toolbar"
					aria-label="Filter by production company"
				>
					<Tooltip>
						<TooltipTrigger
							render={
								<button
									type="button"
									aria-pressed={selectedStudioId == null}
									onClick={() => onSelectStudio(null)}
									className={cn(
										studioChipClass(selectedStudioId == null),
										"font-medium text-[10px]",
										selectedStudioId != null && "opacity-70",
									)}
								>
									All
								</button>
							}
						/>
						<TooltipContent side="top">All studios</TooltipContent>
					</Tooltip>
					{loading ? <SearchDialogStudioRailSkeleton /> : null}
					{studios.map((studio) => {
						const selected = selectedStudioId === studio.id;
						const short = studioShortName(studio.name);
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
											className={studioChipClass(selected)}
										>
											{studio.logoUrl ? (
												<Image
													src={studio.logoUrl}
													alt=""
													width={44}
													height={44}
													className="size-9 object-contain p-1"
													unoptimized
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
	);
}
