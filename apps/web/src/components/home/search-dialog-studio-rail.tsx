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
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	type SearchDialogStudio,
	studioShortName,
} from "@/lib/search-dialog-studios";

/**
 * Canvas chip on the search dialog’s `bg-card` sheet — always `bg-background` so TMDb
 * logos read clearly; selected state is full opacity, never rings/borders/shadows.
 */
function studioChipClass(selected: boolean) {
	return cn(
		"inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background transition-[opacity,color] duration-200 ease-out motion-reduce:transition-none",
		selected
			? "text-foreground opacity-100"
			: cn("opacity-85", DETAIL_CANVAS_ON_CARD_HOVER_CLASS),
	);
}

/**
 * Horizontal studio logos above the Popular preview column (Movies browse only).
 */
export function SearchDialogStudioRail({
	studios,
	selectedStudioId,
	onSelectStudio,
	loading,
}: {
	studios: SearchDialogStudio[];
	selectedStudioId: number | null;
	onSelectStudio: (id: number | null) => void;
	loading?: boolean;
}) {
	if (!loading && studios.length === 0) return null;

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
										selectedStudioId == null
											? "text-foreground"
											: "text-muted-foreground",
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
											aria-label={`${studio.name} films`}
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
												<span className="px-1 font-semibold text-[9px] text-foreground uppercase tracking-wide">
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
