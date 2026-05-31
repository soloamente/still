import type { ListDetailFilmRow } from "@/components/list/list-detail-films-grid";
import type { RankedListReorderRow } from "@/components/list/ranked-list-reorder-grid";

export function canReorderRankedList({
	isRanked,
	viewerId,
	viewerCanEdit,
}: {
	isRanked: boolean;
	viewerId: string | null | undefined;
	/** From `GET /api/lists/:id` — owner or invited collaborator. */
	viewerCanEdit: boolean;
}): boolean {
	if (!isRanked || !viewerId) return false;
	return viewerCanEdit;
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
