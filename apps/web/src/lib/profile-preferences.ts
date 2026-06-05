import {
	type AppThemeClass,
	DEFAULT_APP_THEME_CLASS,
	resolveAppTheme,
} from "@/lib/app-themes";
import {
	catalogWatchRegionIsoToTmdbLanguage,
	isCatalogTmdbLanguageCode,
} from "@/lib/catalog-tmdb-language";

/**
 * Stable keys under profile `preferences` (opaque JSON; Settings PATCH shallow-merges).
 * Use these constants in the web app so reads/writes stay aligned.
 */
export const PROFILE_PREF_CATALOG_MONOCHROME_PEERS_ON_HOVER =
	"catalogMonochromePeersOnHover" as const;

/**
 * TMDb `language` for catalogue copy (genre pills, search tags, title locale).
 * When unset, {@link resolveCatalogTmdbLanguage} falls back to watch region.
 */
export const PROFILE_PREF_CATALOG_TMDB_LANGUAGE =
	"catalogTmdbLanguage" as const;

/**
 * TMDb catalogue `watch_region` for **subscription / streaming** slices (ISO 3166-1 alpha-2),
 * or **`ALL`** to omit a regional filter (broader TMDb discover). Stored under profile `preferences`.
 */
export const PROFILE_PREF_CATALOG_TMDB_WATCH_REGION =
	"catalogTmdbWatchRegion" as const;

/** Named shell palette class on `<html>` (see `app-themes.ts`). */
export const PROFILE_PREF_APP_THEME = "appTheme" as const;

/** Lenis wheel smoothing — opt-in from Settings → Experience (default off). */
export const PROFILE_PREF_SMOOTH_SCROLL = "smoothScroll" as const;

/** 18+ films and anime in catalogue surfaces — opt-in from Settings → Catalogue (default off). */
export const PROFILE_PREF_SHOW_ADULT_CONTENT = "showAdultContent" as const;

/** Optional month/day birthday line on public profile — default off. */
export const PROFILE_PREF_SHOW_BIRTH_DATE_ON_PROFILE =
	"showBirthDateOnProfile" as const;

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
 * Default `false` — patrons opt in from Settings.
 * Persisted `true` enables the effect.
 */
/** Explicit catalogue language, or `null` to derive from watch region. */
export function readCatalogTmdbLanguagePref(
	preferences: Record<string, unknown> | null | undefined,
): string | null {
	if (preferences == null) return null;
	const raw = preferences[PROFILE_PREF_CATALOG_TMDB_LANGUAGE];
	if (raw == null || raw === "") return null;
	if (typeof raw !== "string") return null;
	const s = raw.trim();
	return isCatalogTmdbLanguageCode(s) ? s : null;
}

/**
 * Patron-facing TMDb language: explicit Settings choice → watch region map → `en-US`.
 */
export function resolveCatalogTmdbLanguage(
	preferences: Record<string, unknown> | null | undefined,
): string {
	const explicit = readCatalogTmdbLanguagePref(preferences);
	if (explicit) return explicit;
	const region = readCatalogTmdbWatchRegionPref(preferences);
	if (region && region !== "ALL") {
		return catalogWatchRegionIsoToTmdbLanguage(region);
	}
	return "en-US";
}

export function readCatalogMonochromePeersOnHoverPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	if (preferences == null) return false;
	const raw = preferences[PROFILE_PREF_CATALOG_MONOCHROME_PEERS_ON_HOVER];
	return raw === true;
}

/** Smooth Lenis wheel scroll — default off so low-end devices stay native. */
export function readSmoothScrollPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	if (preferences == null) return false;
	return preferences[PROFILE_PREF_SMOOTH_SCROLL] === true;
}

/** Adult catalogue opt-in — default off when unset. */
export function readShowAdultContentPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	if (preferences == null) return false;
	return preferences[PROFILE_PREF_SHOW_ADULT_CONTENT] === true;
}

/** Public profile birthday line — default off when unset. */
export function readShowBirthDateOnProfilePref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	if (preferences == null) return false;
	return preferences[PROFILE_PREF_SHOW_BIRTH_DATE_ON_PROFILE] === true;
}

/** True when the patron saved a palette in Settings / account menu (key present in JSON). */
export function hasExplicitAppThemePref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	if (preferences == null) return false;
	return PROFILE_PREF_APP_THEME in preferences;
}

export function readAppThemePref(
	preferences: Record<string, unknown> | null | undefined,
): AppThemeClass {
	if (preferences == null) return DEFAULT_APP_THEME_CLASS;
	return resolveAppTheme(preferences[PROFILE_PREF_APP_THEME]);
}
