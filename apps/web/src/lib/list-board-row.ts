/**
 * Normalized list row for Savee-style UI (`ListRowStrip`) + `GET /api/lists/*`
 * payloads after `coverPosterPaths` hydration.
 */
export interface ListBoardRow {
	id: string;
	title: string;
	description: string | null;
	itemsCount: number;
	likesCount: number;
	coverMovieIds: number[];
	coverPosterPaths: (string | null)[];
	updatedAt: string;
	isPublic: boolean;
}

/** Coerce an API / JSON blob into a `ListBoardRow` (safe for mixed Eden payloads). */
export function toListBoardRow(raw: unknown): ListBoardRow {
	const r = raw as Record<string, unknown>;
	const coverMovieIds = Array.isArray(r.coverMovieIds)
		? (r.coverMovieIds as number[])
		: [];
	const coverPosterPaths = Array.isArray(r.coverPosterPaths)
		? (r.coverPosterPaths as (string | null)[])
		: coverMovieIds.map(() => null);
	return {
		id: String(r.id ?? ""),
		title: String(r.title ?? ""),
		description: r.description != null ? String(r.description) : null,
		itemsCount: Number(r.itemsCount ?? 0),
		likesCount: Number(r.likesCount ?? 0),
		coverMovieIds,
		coverPosterPaths,
		updatedAt: String(r.updatedAt ?? ""),
		isPublic: Boolean(r.isPublic ?? true),
	};
}
