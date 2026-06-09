import { describe, expect, test } from "bun:test";

import {
	PROFILE_PREF_CAST_CREW_MONOCHROME_ON_HOVER,
	PROFILE_PREF_CATALOG_TMDB_LANGUAGE,
	PROFILE_PREF_CATALOG_TMDB_WATCH_REGION,
	PROFILE_PREF_SHOW_ADULT_CONTENT,
	PROFILE_PREF_SHOW_BIRTH_DATE_ON_PROFILE,
	PROFILE_PREF_SMOOTH_SCROLL,
	readCastCrewMonochromeOnHoverPref,
	readCatalogTmdbLanguagePref,
	readShowAdultContentPref,
	readShowBirthDateOnProfilePref,
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

describe("readShowAdultContentPref", () => {
	test("defaults to false", () => {
		expect(readShowAdultContentPref(null)).toBe(false);
		expect(readShowAdultContentPref({})).toBe(false);
	});

	test("reads explicit true", () => {
		expect(
			readShowAdultContentPref({
				[PROFILE_PREF_SHOW_ADULT_CONTENT]: true,
			}),
		).toBe(true);
	});
});

describe("readShowBirthDateOnProfilePref", () => {
	test("defaults to false", () => {
		expect(readShowBirthDateOnProfilePref(null)).toBe(false);
	});

	test("reads explicit true", () => {
		expect(
			readShowBirthDateOnProfilePref({
				[PROFILE_PREF_SHOW_BIRTH_DATE_ON_PROFILE]: true,
			}),
		).toBe(true);
	});
});

describe("readCastCrewMonochromeOnHoverPref", () => {
	test("defaults to false", () => {
		expect(readCastCrewMonochromeOnHoverPref(null)).toBe(false);
		expect(readCastCrewMonochromeOnHoverPref({})).toBe(false);
	});

	test("reads explicit true", () => {
		expect(
			readCastCrewMonochromeOnHoverPref({
				[PROFILE_PREF_CAST_CREW_MONOCHROME_ON_HOVER]: true,
			}),
		).toBe(true);
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
