import type { ListDetailFilmRow } from "@/components/list/list-detail-films-grid";
import type { RankedListReorderRow } from "@/components/list/ranked-list-reorder-grid";

export function canReorderRankedList({
	isRanked,
	viewerId,
	ownerId,
	isCollaborative,
}: {
	isRanked: boolean;
	viewerId: string | null | undefined;
	ownerId: string;
	isCollaborative: boolean;
}): boolean {
	if (!isRanked || !viewerId) return false;
	return viewerId === ownerId || isCollaborative;
}

export function toRankedReorderRows(
	rows: ListDetailFilmRow[],
): RankedListReorderRow[] {
	// Reorder flow must use stable list item ids and only valid poster-backed rows.
	return rows.filter(
		(row): row is RankedListReorderRow =>
			typeof row.item.id === "string" &&
			row.item.id.length > 0 &&
			(row.movie != null || row.tv != null),
	);
}
