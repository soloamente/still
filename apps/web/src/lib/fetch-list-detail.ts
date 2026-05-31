import "server-only";

import type { ListDetailFilmRow } from "@/components/list/list-detail-films-grid";
import { serverApi } from "@/lib/server-api";

export type ListDetailRecord = {
	id: string;
	userId: string;
	title: string;
	description: string | null;
	systemKind?: string | null;
	itemsCount: number;
	coverMovieIds: number[];
	coverMovieId: number | null;
	coverTvId?: number | null;
	coverImageUrl: string | null;
	isPublic: boolean;
	isRanked: boolean;
	isCollaborative?: boolean;
	viewerCanEdit?: boolean;
	owner?: { handle: string; displayName: string } | null;
	collaborators?: Array<{
		userId: string;
		handle: string;
		displayName: string;
	}>;
	updatedAt: string;
	likesCount?: number;
	liked?: boolean;
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

export function listDetailToFilmRows(
	data: ListDetailRecord,
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

/** Load list detail for RSC pages (respects API visibility — private lists 404 for guests). */
export async function fetchListDetailById(
	listId: string,
): Promise<ListDetailRecord | null> {
	const api = await serverApi();
	const listRes = await api.api.lists({ id: listId }).get();
	if (listRes.error || !listRes.data) return null;
	const raw = listRes.data as unknown as ListDetailRecord & {
		updatedAt: string | Date;
	};
	return {
		...raw,
		updatedAt:
			typeof raw.updatedAt === "string"
				? raw.updatedAt
				: new Date(raw.updatedAt).toISOString(),
	};
}
