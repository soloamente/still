"use client";

import { SearchDialogPeopleRow } from "@/components/home/search-dialog-people-row";
import { SearchDialogListSkeleton } from "@/components/home/search-dialog-result-skeletons";
import type { ProfileSearchHit } from "@/lib/profile-search-query";

export function SearchDialogPeopleResults({
	hits,
	loading,
	onSelect,
}: {
	hits: ProfileSearchHit[];
	loading: boolean;
	onSelect: (handle: string) => void;
}) {
	if (loading && hits.length === 0) {
		return (
			<div className="px-4 pb-2">
				<div className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
					People
				</div>
				<SearchDialogListSkeleton />
			</div>
		);
	}

	if (hits.length === 0) return null;

	return (
		<div className="px-4 pb-2">
			<div className="mb-1 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
				People
			</div>
			<ul className="space-y-0.5">
				{hits.map((hit) => (
					<SearchDialogPeopleRow
						key={hit.userId}
						handle={hit.handle}
						displayName={hit.displayName}
						image={hit.image}
						relationship={hit.relationship}
						onSelect={() => onSelect(hit.handle)}
					/>
				))}
			</ul>
		</div>
	);
}
