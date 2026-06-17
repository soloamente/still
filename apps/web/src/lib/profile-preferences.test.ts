import { describe, expect, test } from "bun:test";

import {
	PROFILE_PREF_AVATAR_IS_ANIMATED,
	PROFILE_PREF_CAST_CREW_MONOCHROME_ON_HOVER,
	PROFILE_PREF_CATALOG_TMDB_LANGUAGE,
	PROFILE_PREF_CATALOG_TMDB_WATCH_REGION,
	PROFILE_PREF_PROFILE_PORTRAIT_GRAYSCALE_UNTIL_HOVER,
	PROFILE_PREF_SHOW_ADULT_CONTENT,
	PROFILE_PREF_SHOW_BIRTH_DATE_ON_PROFILE,
	PROFILE_PREF_SMOOTH_SCROLL,
	PROFILE_PRESENCE_VISIBILITY_FRIENDS,
	PROFILE_PRESENCE_VISIBILITY_PUBLIC,
	readAvatarIsAnimatedPref,
	readCastCrewMonochromeOnHoverPref,
	readCatalogTmdbLanguagePref,
	readProfilePortraitGrayscaleUntilHoverPref,
	readProfilePresenceVisibilityPref,
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

describe("readProfilePortraitGrayscaleUntilHoverPref", () => {
	test("defaults to true when preferences are null", () => {
		expect(readProfilePortraitGrayscaleUntilHoverPref(null)).toBe(true);
		expect(readProfilePortraitGrayscaleUntilHoverPref(undefined)).toBe(true);
	});

	test("defaults to true when key is missing or not false", () => {
		expect(readProfilePortraitGrayscaleUntilHoverPref({})).toBe(true);
		expect(
			readProfilePortraitGrayscaleUntilHoverPref({
				[PROFILE_PREF_PROFILE_PORTRAIT_GRAYSCALE_UNTIL_HOVER]: true,
			}),
		).toBe(true);
	});

	test("returns false only when explicitly set to false", () => {
		expect(
			readProfilePortraitGrayscaleUntilHoverPref({
				[PROFILE_PREF_PROFILE_PORTRAIT_GRAYSCALE_UNTIL_HOVER]: false,
			}),
		).toBe(false);
	});
});

describe("readAvatarIsAnimatedPref", () => {
	test("defaults to false", () => {
		expect(readAvatarIsAnimatedPref(null)).toBe(false);
		expect(readAvatarIsAnimatedPref({})).toBe(false);
	});

	test("reads explicit true", () => {
		expect(
			readAvatarIsAnimatedPref({
				[PROFILE_PREF_AVATAR_IS_ANIMATED]: true,
			}),
		).toBe(true);
	});
});

describe("readProfilePresenceVisibilityPref", () => {
	test("defaults to friends when missing", () => {
		expect(readProfilePresenceVisibilityPref(null)).toBe(
			PROFILE_PRESENCE_VISIBILITY_FRIENDS,
		);
		expect(readProfilePresenceVisibilityPref({})).toBe(
			PROFILE_PRESENCE_VISIBILITY_FRIENDS,
		);
	});

	test("reads public when explicitly set", () => {
		expect(
			readProfilePresenceVisibilityPref({
				privacy: { presenceVisibility: "public" },
			}),
		).toBe(PROFILE_PRESENCE_VISIBILITY_PUBLIC);
	});

	test("falls back to friends for invalid values", () => {
		expect(
			readProfilePresenceVisibilityPref({
				privacy: { presenceVisibility: "everyone" },
			}),
		).toBe(PROFILE_PRESENCE_VISIBILITY_FRIENDS);
	});
});
