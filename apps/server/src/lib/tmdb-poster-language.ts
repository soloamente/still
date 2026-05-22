import { db, profile } from "@still/db";
import { eq } from "drizzle-orm";

/**
 * Must match `PROFILE_PREF_CATALOG_TMDB_WATCH_REGION` in `apps/web` — stored under
 * `profile.preferences` when the patron picks a catalogue country in Settings.
 */
const CATALOG_TMDB_WATCH_REGION_PREF_KEY = "catalogTmdbWatchRegion" as const;
const CATALOG_TMDB_LANGUAGE_PREF_KEY = "catalogTmdbLanguage" as const;

const TMDB_LANGUAGE_WHITELIST = new Set([
	"en-US",
	"en-GB",
	"es-ES",
	"fr-FR",
	"de-DE",
	"it-IT",
	"pt-BR",
	"pt-PT",
	"nl-NL",
	"ja-JP",
	"ko-KR",
	"sv-SE",
	"da-DK",
	"fi-FI",
	"pl-PL",
]);

/**
 * ISO 3166-1 alpha-2 (TMDb `watch_region`) → TMDb v3 `language` query value.
 * TMDb uses this locale to pick default `poster_path` / `backdrop_path` per title.
 *
 * Keep in sync with `CATALOG_WATCH_REGION_OPTIONS` in the web app; unknown codes
 * fall back to `en-US`.
 */
const WATCH_REGION_ISO2_TO_TMDB_LANGUAGE: Record<string, string> = {
	US: "en-US",
	GB: "en-GB",
	CA: "en-CA",
	AU: "en-AU",
	DE: "de-DE",
	FR: "fr-FR",
	IT: "it-IT",
	ES: "es-ES",
	NL: "nl-NL",
	JP: "ja-JP",
	KR: "ko-KR",
	BR: "pt-BR",
	MX: "es-MX",
	IN: "hi-IN",
	SE: "sv-SE",
	NO: "nb-NO",
	DK: "da-DK",
	FI: "fi-FI",
	IE: "en-IE",
	NZ: "en-NZ",
	PL: "pl-PL",
	PT: "pt-PT",
	AT: "de-AT",
	CH: "de-CH",
	BE: "nl-BE",
};

/** Maps a saved watch-region pref to the TMDb `language` param (posters + copy). */
export function catalogWatchRegionIsoToTmdbLanguage(
	iso3166Alpha2: string | null | undefined,
): string {
	if (iso3166Alpha2 == null) return "en-US";
	const s = iso3166Alpha2.trim().toUpperCase();
	if (s === "" || s === "ALL" || s === "ANY" || s === "WORLD") return "en-US";
	if (s.length === 2 && /^[A-Z]{2}$/.test(s)) {
		return WATCH_REGION_ISO2_TO_TMDB_LANGUAGE[s] ?? "en-US";
	}
	return "en-US";
}

/**
 * Resolves the TMDb locale for the current patron so list + detail posters match
 * the country they chose in Settings (`catalogTmdbWatchRegion`).
 */
function readCatalogTmdbLanguagePref(
	preferences: Record<string, unknown> | null | undefined,
): string | null {
	if (preferences == null) return null;
	const raw = preferences[CATALOG_TMDB_LANGUAGE_PREF_KEY];
	if (raw == null || raw === "") return null;
	if (typeof raw !== "string") return null;
	const s = raw.trim();
	return TMDB_LANGUAGE_WHITELIST.has(s) ? s : null;
}

export async function getTmdbLanguageForUser(
	userId: string | null | undefined,
): Promise<string> {
	if (!userId) return "en-US";
	try {
		const [row] = await db
			.select({ preferences: profile.preferences })
			.from(profile)
			.where(eq(profile.userId, userId))
			.limit(1);
		const prefs = row?.preferences ?? null;
		const explicit = readCatalogTmdbLanguagePref(prefs);
		if (explicit) return explicit;
		const regionRaw = prefs?.[CATALOG_TMDB_WATCH_REGION_PREF_KEY];
		if (regionRaw == null || regionRaw === "") return "en-US";
		if (typeof regionRaw !== "string") return "en-US";
		return catalogWatchRegionIsoToTmdbLanguage(regionRaw);
	} catch (err) {
		// Neon quota / connectivity — catalogue routes should still return TMDb sheets.
		console.error(
			"[tmdb-poster-language] profile prefs unavailable, using en-US",
			err,
		);
		return "en-US";
	}
}
