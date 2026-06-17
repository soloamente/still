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

/** Opt-in for watchlist streaming inbox alerts — default on (Task 18 Settings toggle). */
export const PROFILE_PREF_WATCHLIST_STREAMING_ALERTS =
	"watchlistStreamingAlerts" as const;

/** Named shell palette class on `<html>` (see `app-themes.ts`). */
export const PROFILE_PREF_APP_THEME = "appTheme" as const;

/** Lenis wheel smoothing — opt-in from Settings → Experience (default off). */
export const PROFILE_PREF_SMOOTH_SCROLL = "smoothScroll" as const;

/**
 * Film/TV cast & crew headshots: grayscale until hover on detail previews.
 * Opt-in from Settings → Experience (default off — full color).
 */
export const PROFILE_PREF_CAST_CREW_MONOCHROME_ON_HOVER =
	"castCrewMonochromeOnHover" as const;

/** 18+ films and anime in catalogue surfaces — opt-in from Settings → Catalogue (default off). */
export const PROFILE_PREF_SHOW_ADULT_CONTENT = "showAdultContent" as const;

/** Optional month/day birthday line on public profile — default off. */
export const PROFILE_PREF_SHOW_BIRTH_DATE_ON_PROFILE =
	"showBirthDateOnProfile" as const;

/** Profile portrait: grayscale until hover — default on unless explicitly opted out. */
export const PROFILE_PREF_PROFILE_PORTRAIT_GRAYSCALE_UNTIL_HOVER =
	"profilePortraitGrayscaleUntilHover" as const;

/** Avatar GIF playback — opt-in when patron uploads animated media. */
export const PROFILE_PREF_AVATAR_IS_ANIMATED = "avatarIsAnimated" as const;

/** Banner GIF playback — opt-in when patron uploads animated media. */
export const PROFILE_PREF_BANNER_IS_ANIMATED = "bannerIsAnimated" as const;
export const PROFILE_PREF_PRIVACY_PRESENCE_VISIBILITY =
	"presenceVisibility" as const;
export const PROFILE_PRESENCE_VISIBILITY_FRIENDS = "friends" as const;
export const PROFILE_PRESENCE_VISIBILITY_PUBLIC = "public" as const;
export type ProfilePresenceVisibilityPref =
	| typeof PROFILE_PRESENCE_VISIBILITY_FRIENDS
	| typeof PROFILE_PRESENCE_VISIBILITY_PUBLIC;

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

/** Watchlist streaming notifications — default on unless patron disables in Settings. */
export function readWatchlistStreamingAlertsPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	if (preferences == null) return true;
	const raw = preferences[PROFILE_PREF_WATCHLIST_STREAMING_ALERTS];
	if (typeof raw === "boolean") return raw;
	return true;
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

/** Cast & crew previews on film/TV detail — grayscale until hover when opted in. */
export function readCastCrewMonochromeOnHoverPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	if (preferences == null) return false;
	const raw = preferences[PROFILE_PREF_CAST_CREW_MONOCHROME_ON_HOVER];
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

/** Profile portrait grayscale-on-idle — default on; only explicit `false` opts out. */
export function readProfilePortraitGrayscaleUntilHoverPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	if (preferences == null) return true;
	return (
		preferences[PROFILE_PREF_PROFILE_PORTRAIT_GRAYSCALE_UNTIL_HOVER] !== false
	);
}

export function readAvatarIsAnimatedPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	return preferences?.[PROFILE_PREF_AVATAR_IS_ANIMATED] === true;
}

export function readBannerIsAnimatedPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	return preferences?.[PROFILE_PREF_BANNER_IS_ANIMATED] === true;
}

/**
 * Presence identity visibility is nested under `preferences.privacy` and defaults
 * to friends-only when missing or malformed.
 */
export function readProfilePresenceVisibilityPref(
	preferences: Record<string, unknown> | null | undefined,
): ProfilePresenceVisibilityPref {
	const privacy = preferences?.privacy;
	if (!privacy || typeof privacy !== "object") {
		return PROFILE_PRESENCE_VISIBILITY_FRIENDS;
	}
	const raw = (privacy as Record<string, unknown>)[
		PROFILE_PREF_PRIVACY_PRESENCE_VISIBILITY
	];
	if (raw === PROFILE_PRESENCE_VISIBILITY_PUBLIC) {
		return PROFILE_PRESENCE_VISIBILITY_PUBLIC;
	}
	return PROFILE_PRESENCE_VISIBILITY_FRIENDS;
}
