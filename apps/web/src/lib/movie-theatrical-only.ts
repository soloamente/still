/** TMDb `release_dates.type` — https://developer.themoviedb.org/reference/movie-release-dates */
const TMDB_RELEASE_TYPE_THEATRICAL_LIMITED = 2;
const TMDB_RELEASE_TYPE_THEATRICAL = 3;
const TMDB_RELEASE_TYPE_DIGITAL = 4;

export type TmdbReleaseDatesPayload = {
	results?: Array<{
		iso_3166_1?: string;
		release_dates?: Array<{
			release_date?: unknown;
			type?: number;
		}>;
	}>;
};

function tmdbDayStamp(raw: unknown): string | null {
	if (raw == null) return null;
	if (typeof raw === "string") {
		const s = raw.trim();
		return s.length >= 10 ? s.slice(0, 10) : s || null;
	}
	if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
		return raw.toISOString().slice(0, 10);
	}
	return null;
}

function utcTodayStamp(now: Date): string {
	return now.toISOString().slice(0, 10);
}

function hasPastReleaseOfType(
	payload: TmdbReleaseDatesPayload | null | undefined,
	types: number[],
	today: string,
): boolean {
	for (const block of payload?.results ?? []) {
		for (const rd of block.release_dates ?? []) {
			if (rd.type == null || !types.includes(rd.type)) continue;
			const day = tmdbDayStamp(rd.release_date);
			if (day != null && day <= today) return true;
		}
	}
	return false;
}

/**
 * True when TMDb lists a past theatrical bow but no past digital release —
 * Streaming tab empty state can say “only in cinemas” instead of a sync error.
 */
export function movieLooksTheatricalOnly(
	releaseDates: TmdbReleaseDatesPayload | null | undefined,
	now: Date = new Date(),
): boolean {
	const today = utcTodayStamp(now);
	const theatrical = hasPastReleaseOfType(
		releaseDates,
		[TMDB_RELEASE_TYPE_THEATRICAL_LIMITED, TMDB_RELEASE_TYPE_THEATRICAL],
		today,
	);
	if (!theatrical) return false;
	const digital = hasPastReleaseOfType(
		releaseDates,
		[TMDB_RELEASE_TYPE_DIGITAL],
		today,
	);
	return !digital;
}
