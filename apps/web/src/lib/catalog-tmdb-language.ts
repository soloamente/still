/**
 * TMDb `language` codes for catalogue copy (genre names, titles, posters).
 * Keep option values aligned with `getTmdbLanguageForUser` on the server.
 */

export const CATALOG_TMDB_LANGUAGE_OPTIONS = [
	{ value: "en-US", label: "English (US)" },
	{ value: "en-GB", label: "English (UK)" },
	{ value: "es-ES", label: "Español" },
	{ value: "fr-FR", label: "Français" },
	{ value: "de-DE", label: "Deutsch" },
	{ value: "it-IT", label: "Italiano" },
	{ value: "pt-BR", label: "Português (Brasil)" },
	{ value: "pt-PT", label: "Português" },
	{ value: "nl-NL", label: "Nederlands" },
	{ value: "ja-JP", label: "日本語" },
	{ value: "ko-KR", label: "한국어" },
	{ value: "sv-SE", label: "Svenska" },
	{ value: "da-DK", label: "Dansk" },
	{ value: "fi-FI", label: "Suomi" },
	{ value: "pl-PL", label: "Polski" },
] as const;

export type CatalogTmdbLanguageCode =
	(typeof CATALOG_TMDB_LANGUAGE_OPTIONS)[number]["value"];

const TMDB_LANGUAGE_WHITELIST = new Set<string>(
	CATALOG_TMDB_LANGUAGE_OPTIONS.map((o) => o.value),
);

/** ISO 3166-1 alpha-2 watch region → default TMDb language when catalogue language is unset. */
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

export function isCatalogTmdbLanguageCode(
	value: string,
): value is CatalogTmdbLanguageCode {
	return TMDB_LANGUAGE_WHITELIST.has(value);
}
