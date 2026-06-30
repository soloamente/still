"use client";

import { SearchDialogCastCrewRow } from "@/components/home/search-dialog-cast-crew-row";
import { SearchDialogListSkeleton } from "@/components/home/search-dialog-result-skeletons";
import type { CastCrewSearchHit } from "@/lib/cast-crew-search-query";

export function SearchDialogCastCrewResults({
	results,
	loading,
	onSelect,
}: {
	results: CastCrewSearchHit[];
	loading: boolean;
	onSelect: (id: number) => void;
}) {
	if (loading && results.length === 0) {
		return (
			<div className="px-4 pb-2">
				<div className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
					Cast & Crew
				</div>
				<SearchDialogListSkeleton />
			</div>
		);
	}

	if (results.length === 0) return null;

	return (
		<div className="px-4 pb-2">
			<div className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
				Cast & Crew
			</div>
			<ul className="space-y-0.5">
				{results.map((hit) => (
					<SearchDialogCastCrewRow
						key={hit.id}
						hit={hit}
						onSelect={() => onSelect(hit.id)}
					/>
				))}
			</ul>
		</div>
	);
}
