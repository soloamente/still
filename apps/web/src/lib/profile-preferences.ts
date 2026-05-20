/**
 * Stable keys under profile `preferences` (opaque JSON; Settings PATCH shallow-merges).
 * Use these constants in the web app so reads/writes stay aligned.
 */
export const PROFILE_PREF_CATALOG_MONOCHROME_PEERS_ON_HOVER =
	"catalogMonochromePeersOnHover" as const;

/**
 * TMDb catalogue `watch_region` for **subscription / streaming** slices (ISO 3166-1 alpha-2),
 * or **`ALL`** to omit a regional filter (broader TMDb discover). Stored under profile `preferences`.
 */
export const PROFILE_PREF_CATALOG_TMDB_WATCH_REGION =
	"catalogTmdbWatchRegion" as const;

/** `null` = patron has not chosen yet (home shows one-time region prompt when signed in). */
export type CatalogTmdbWatchRegionPref = "ALL" | string | null;

/**
 * Reads streaming catalogue region preference. Invalid legacy values are treated as unset
 * so the home prompt can ask again.
 */
export function readCatalogTmdbWatchRegionPref(
	preferences: Record<string, unknown> | null | undefined,
): CatalogTmdbWatchRegionPref {
	if (preferences == null) return null;
	const raw = preferences[PROFILE_PREF_CATALOG_TMDB_WATCH_REGION];
	if (raw == null || raw === "") return null;
	if (typeof raw !== "string") return null;
	const s = raw.trim().toUpperCase();
	if (s === "ALL" || s === "ANY" || s === "WORLD") return "ALL";
	if (s.length === 2 && /^[A-Z]{2}$/.test(s)) return s;
	return null;
}

/**
 * Maps profile pref → `GET /api/movies|tv/discover?watch_region=` (`undefined` = let the API use its
 * default; **`ALL`** = omit TMDb’s regional filter for “all countries / regions”).
 */
export function catalogWatchRegionToApiQuery(
	pref: CatalogTmdbWatchRegionPref,
): string | undefined {
	if (pref === null) return undefined;
	if (pref === "ALL") return "ALL";
	return pref;
}

/**
 * Home lobby: when `true`, non-hovered poster tiles use sibling `grayscale` (CSS `:has()`).
 * Default `true` so existing users keep current behavior until they turn it off in Settings.
 * Persisted `false` disables the effect.
 */
export function readCatalogMonochromePeersOnHoverPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	if (preferences == null) return true;
	const raw = preferences[PROFILE_PREF_CATALOG_MONOCHROME_PEERS_ON_HOVER];
	if (raw === false) return false;
	return true;
}
