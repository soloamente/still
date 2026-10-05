"use client";

import { useRef } from "react";

import { SearchDialogCastCrewRow } from "@/components/home/search-dialog-cast-crew-row";
import { SearchDialogListSkeleton } from "@/components/home/search-dialog-result-skeletons";
import type { CastCrewSearchHit } from "@/lib/cast-crew-search-query";
import { SearchDialogRailTooltipProvider } from "@/lib/catalog-search-tooltip-portal";

export function SearchDialogCastCrewResults({
	results,
	loading,
	onSelect,
	heading = "Cast & Crew",
	keyboardFocusedIndex = null,
	resultIndexBase = 0,
}: {
	results: CastCrewSearchHit[];
	loading: boolean;
	onSelect: (id: number) => void;
	heading?: string;
	keyboardFocusedIndex?: number | null;
	resultIndexBase?: number;
}) {
	const listRef = useRef<HTMLUListElement>(null);

	if (loading && results.length === 0) {
		return (
			<div className="px-0.5 pb-2">
				<div className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
					{heading}
				</div>
				<SearchDialogListSkeleton />
			</div>
		);
	}

	if (results.length === 0) return null;

	return (
		<div className="px-0.5 pb-2">
			<div className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
				{heading}
			</div>
			<SearchDialogRailTooltipProvider>
				<ul ref={listRef} className="space-y-0.5">
					{results.map((hit, index) => {
						const resultIndex = resultIndexBase + index;
						return (
							<SearchDialogCastCrewRow
								key={hit.id}
								hit={hit}
								resultIndex={resultIndex}
								keyboardFocused={keyboardFocusedIndex === resultIndex}
								onSelect={() => onSelect(hit.id)}
							/>
						);
					})}
				</ul>
			</SearchDialogRailTooltipProvider>
		</div>
	);
}
