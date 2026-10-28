import "server-only";

import {
	type ContentPrivateKind,
	contentPrivateCodeFromEdenError,
	contentPrivateKindFromCode,
} from "@/lib/content-private";
import { edenApiErrorStatus } from "@/lib/eden-api-error";
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

export type ListDetailFetchResult =
	| { status: "ok"; data: ListDetailRecord }
	| { status: "private"; kind: ContentPrivateKind }
	| { status: "missing" };

export { listDetailToFilmRows };

/**
 * Load list detail for RSC pages. Private lists return `private` (403) rather
 * than collapsing into a silent miss — callers render ContentPrivatePageShell.
 */
export async function fetchListDetailById(
	listId: string,
): Promise<ListDetailFetchResult> {
	const api = await serverApi();
	const listRes = await api.api.lists({ id: listId }).get();
	if (listRes.error) {
		const httpStatus = edenApiErrorStatus(listRes.error);
		const privateCode = contentPrivateCodeFromEdenError(listRes.error);
		if (httpStatus === 403 && privateCode) {
			return {
				status: "private",
				kind: contentPrivateKindFromCode(privateCode),
			};
		}
		return { status: "missing" };
	}
	if (!listRes.data) return { status: "missing" };
	const raw = listRes.data as unknown as ListDetailRecord & {
		updatedAt: string | Date;
	};
	return {
		status: "ok",
		data: {
			...raw,
			updatedAt:
				typeof raw.updatedAt === "string"
					? raw.updatedAt
					: new Date(raw.updatedAt).toISOString(),
		},
	};
}
