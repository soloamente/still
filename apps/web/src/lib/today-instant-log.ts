/**
 * Body for Today **Watched** — an instant diary save with no sheet.
 * Local noon keeps the diary day stable across time zones (same as Quick Log);
 * `watchVenue: null` records the venue as unset instead of defaulting to at home;
 * visibility is omitted so the account default applies.
 */
export type TodayInstantLogPayload = {
	movieId: number;
	watchedAt: string;
	watchVenue: null;
	rewatch?: true;
};

export function buildTodayInstantLogPayload({
	tmdbId,
	priorLogCount,
	todayYmd,
}: {
	tmdbId: number;
	priorLogCount: number;
	/** Local `YYYY-MM-DD` — pass `formatTodayYmd()`. */
	todayYmd: string;
}): TodayInstantLogPayload {
	return {
		movieId: tmdbId,
		watchedAt: new Date(`${todayYmd}T12:00:00`).toISOString(),
		watchVenue: null,
		// Client-side rewatch detection (server does not infer it).
		...(priorLogCount > 0 ? { rewatch: true as const } : {}),
	};
}
