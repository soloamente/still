import { describe, expect, test } from "bun:test";

import {
	PROFILE_PREF_CATALOG_TMDB_LANGUAGE,
	PROFILE_PREF_CATALOG_TMDB_WATCH_REGION,
	PROFILE_PREF_SMOOTH_SCROLL,
	readCatalogTmdbLanguagePref,
	readSmoothScrollPref,
	resolveCatalogTmdbLanguage,
} from "./profile-preferences";

describe("resolveCatalogTmdbLanguage", () => {
	test("prefers explicit catalogue language", () => {
		const lang = resolveCatalogTmdbLanguage({
			[PROFILE_PREF_CATALOG_TMDB_LANGUAGE]: "es-ES",
			[PROFILE_PREF_CATALOG_TMDB_WATCH_REGION]: "US",
		});
		expect(lang).toBe("es-ES");
	});

	test("falls back to watch region", () => {
		const lang = resolveCatalogTmdbLanguage({
			[PROFILE_PREF_CATALOG_TMDB_WATCH_REGION]: "ES",
		});
		expect(lang).toBe("es-ES");
	});

	test("defaults to en-US", () => {
		expect(resolveCatalogTmdbLanguage(null)).toBe("en-US");
	});
});

describe("readCatalogTmdbLanguagePref", () => {
	test("rejects invalid codes", () => {
		expect(
			readCatalogTmdbLanguagePref({
				[PROFILE_PREF_CATALOG_TMDB_LANGUAGE]: "xx-XX",
			}),
		).toBeNull();
	});
});

describe("readSmoothScrollPref", () => {
	test("defaults to false", () => {
		expect(readSmoothScrollPref(null)).toBe(false);
		expect(readSmoothScrollPref({})).toBe(false);
	});

	test("reads explicit true", () => {
		expect(readSmoothScrollPref({ [PROFILE_PREF_SMOOTH_SCROLL]: true })).toBe(
			true,
		);
	});
});
