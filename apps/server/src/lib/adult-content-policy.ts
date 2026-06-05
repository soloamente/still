/** Must match `PROFILE_PREF_SHOW_ADULT_CONTENT` in apps/web. */
export const PROFILE_PREF_SHOW_ADULT_CONTENT = "showAdultContent" as const;

export type StillAdultJson = {
	isAdult: boolean;
	sources: ("tmdb" | "mal_rating" | "mal_genre")[];
	fetchedAt: string;
};

export const STILL_ADULT_JSON_KEY = "_stillAdult" as const;

/** Reads patron opt-in for adult catalogue content; absent pref defaults off. */
export function readShowAdultContentPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	return preferences?.[PROFILE_PREF_SHOW_ADULT_CONTENT] === true;
}

export function readStillAdultCache(
	tmdbJson: Record<string, unknown> | null | undefined,
): StillAdultJson | null {
	const block = tmdbJson?.[STILL_ADULT_JSON_KEY] as StillAdultJson | undefined;
	if (!block || typeof block.isAdult !== "boolean") return null;
	return block;
}

export function isMovieAdult(row: { adult?: boolean | null }): boolean {
	return row.adult === true;
}

export function isTvAdultFromRow(row: {
	adult?: boolean | null;
	tmdbJson?: Record<string, unknown> | null;
}): boolean {
	if (row.adult === true) return true;
	return readStillAdultCache(row.tmdbJson ?? null)?.isAdult === true;
}

export function isTmdbSummaryAdult(summary: {
	adult?: boolean | null;
}): boolean {
	return summary.adult === true;
}

export function shouldBlockAdultDetail(
	showAdultContent: boolean,
	isAdult: boolean,
): boolean {
	return isAdult && !showAdultContent;
}

export function filterOutAdultRows<T>(
	rows: T[],
	showAdultContent: boolean,
	isAdultFn: (row: T) => boolean,
): T[] {
	if (showAdultContent) return rows;
	return rows.filter((row) => !isAdultFn(row));
}

/** Minimal detail payload when patron has adult content disabled. */
export function buildAdultBlockedMoviePayload(
	id: number,
	title?: string | null,
) {
	return {
		adultBlocked: true as const,
		kind: "movie" as const,
		tmdbId: id,
		title: title ?? null,
	};
}

export function buildAdultBlockedTvPayload(id: number, title?: string | null) {
	return {
		adultBlocked: true as const,
		kind: "tv" as const,
		tmdbId: id,
		title: title ?? null,
	};
}
