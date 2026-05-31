/** Where we persist Anilist ↔ MAL ↔ TMDb crosswalk on cached TV rows. */
export const STILL_ANILIST_JSON_KEY = "_stillAnilist";
export const STILL_MAL_JSON_KEY = "_stillMal";

export type StillAnilistJson = {
	anilistId?: number;
	idMal?: number | null;
	mappedAt?: string;
};

export type StillMalJson = {
	malId?: number;
	fetchedAt?: string;
	score?: number | null;
	rank?: number | null;
	popularity?: number | null;
	status?: string | null;
};

/** Read a positive MAL anime id from cached TV json (import mapping, enrichment cache, or TMDb external_ids). */
export function readMalIdFromTmdbJson(
	tmdbJson: Record<string, unknown> | null | undefined,
): number | null {
	if (!tmdbJson) return null;

	const stillMal = tmdbJson[STILL_MAL_JSON_KEY] as StillMalJson | undefined;
	if (stillMal?.malId != null && stillMal.malId > 0) {
		return Math.floor(stillMal.malId);
	}

	const stillAnilist = tmdbJson[STILL_ANILIST_JSON_KEY] as
		| StillAnilistJson
		| undefined;
	if (stillAnilist?.idMal != null && stillAnilist.idMal > 0) {
		return Math.floor(stillAnilist.idMal);
	}

	const externalIds = tmdbJson.external_ids as
		| { mal_id?: number | null }
		| undefined;
	if (externalIds?.mal_id != null && externalIds.mal_id > 0) {
		return Math.floor(externalIds.mal_id);
	}

	return null;
}

/** Pull MAL id from a live TMDb detail payload before it is merged into `tv.tmdbJson`. */
export function readMalIdFromTmdbDetail(
	detail: Record<string, unknown> | null | undefined,
): number | null {
	if (!detail) return null;
	return readMalIdFromTmdbJson(detail);
}
