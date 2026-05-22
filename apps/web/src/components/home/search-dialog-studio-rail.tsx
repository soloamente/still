"use client";

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
 * logos read clearly; selected state is stronger opacity + shadow, never rings/borders.
 */
function studioChipClass(selected: boolean) {
	return cn(
		"inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background shadow-sm transition-[box-shadow,opacity,color] duration-200 ease-out motion-reduce:transition-none",
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
			<div
				className="scrollbar-none flex flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain pb-0.5"
				role="toolbar"
				aria-label="Filter by production company"
			>
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
				{loading ? <SearchDialogStudioRailSkeleton /> : null}
				{studios.map((studio) => {
					const selected = selectedStudioId === studio.id;
					const short = studioShortName(studio.name);
					return (
						<button
							key={studio.id}
							type="button"
							aria-pressed={selected}
							aria-label={`${studio.name} films`}
							title={studio.name}
							onClick={() => onSelectStudio(selected ? null : studio.id)}
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
					);
				})}
			</div>
		</div>
	);
}
