import type { ListDetailFilmRow } from "@/components/list/list-detail-films-grid";

/** Shape of `GET /api/lists/:id` used when mapping items to film rows. */
export type ListDetailItemsRecord = {
	items: {
		item: {
			id: string;
			position: number;
			note: string | null;
			movieId: number | null;
			tvId?: number | null;
		};
		movie: { tmdbId: number; title: string; posterPath: string | null } | null;
		tv?: { tmdbId: number; title: string; posterPath: string | null } | null;
		ownerLog?: { rating: number | null; liked: boolean } | null;
	}[];
};

/** Map list detail API items to poster-backed film rows (shared RSC + client realtime refresh). */
export function listDetailToFilmRows(
	data: ListDetailItemsRecord,
): ListDetailFilmRow[] {
	const filmRows: ListDetailFilmRow[] = [];
	for (const row of data.items) {
		if (row.movie) {
			filmRows.push({
				item: row.item,
				movie: row.movie,
				tv: null,
				ownerLog: row.ownerLog ?? null,
			});
		} else if (row.tv) {
			filmRows.push({
				item: row.item,
				movie: null,
				tv: row.tv,
				ownerLog: row.ownerLog ?? null,
			});
		}
	}
	return filmRows;
}
