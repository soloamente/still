/**
 * Normalized list row for Savee-style UI (`ListRowStrip`) + `GET /api/lists/*`
 * payloads after `coverPosterPaths` hydration.
 */
export interface ListBoardRow {
	id: string;
	title: string;
	description: string | null;
	itemsCount: number;
	movieItemsCount: number;
	tvItemsCount: number;
	likesCount: number;
	coverMovieIds: number[];
	coverPosterPaths: (string | null)[];
	coverImageUrl?: string | null;
	coverMovieId?: number | null;
	updatedAt: string;
	isPublic: boolean;
	/** `favorites` = auto-synced from diary hearts; hidden from add-to-list picker. */
	systemKind?: string | null;
	/** Present on `GET /api/lists/me?movieId=` or `?tvId=` — title already on list. */
	containsTitle?: boolean;
	/** @deprecated Use `containsTitle`. */
	containsMovie?: boolean;
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
		movieItemsCount: (() => {
			const itemsCount = Number(r.itemsCount ?? 0);
			const rawMovie = r.movieItemsCount ?? r.movie_items_count;
			const rawTv = r.tvItemsCount ?? r.tv_items_count;
			if (rawMovie != null || rawTv != null) {
				return Number(rawMovie ?? 0);
			}
			return itemsCount;
		})(),
		tvItemsCount: (() => {
			const rawTv = r.tvItemsCount ?? r.tv_items_count;
			if (rawTv != null) return Number(rawTv);
			const rawMovie = r.movieItemsCount ?? r.movie_items_count;
			if (rawMovie != null) return 0;
			return 0;
		})(),
		likesCount: Number(r.likesCount ?? 0),
		coverMovieIds,
		coverPosterPaths,
		coverImageUrl: typeof r.coverImageUrl === "string" ? r.coverImageUrl : null,
		coverMovieId: typeof r.coverMovieId === "number" ? r.coverMovieId : null,
		updatedAt: String(r.updatedAt ?? ""),
		isPublic: Boolean(r.isPublic ?? true),
		systemKind:
			typeof r.systemKind === "string"
				? r.systemKind
				: typeof r.system_kind === "string"
					? r.system_kind
					: null,
		containsTitle:
			"containsTitle" in r
				? Boolean(r.containsTitle)
				: "containsMovie" in r
					? Boolean(r.containsMovie)
					: undefined,
		containsMovie:
			"containsMovie" in r
				? Boolean(r.containsMovie)
				: "containsTitle" in r
					? Boolean(r.containsTitle)
					: undefined,
	};
}
