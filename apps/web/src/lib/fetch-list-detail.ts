import "server-only";

import {
	type ListDetailItemsRecord,
	listDetailToFilmRows,
} from "@/lib/list-detail-film-rows";
import { serverApi } from "@/lib/server-api";

export type ListDetailRecord = ListDetailItemsRecord & {
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
};

export { listDetailToFilmRows };

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
