import { describe, expect, test } from "bun:test";

import {
	ME_SETTINGS_PREF_HOME,
	meSettingsHomeForPref,
} from "./me-settings-pref-homes";

describe("meSettingsHomeForPref", () => {
	test("picture grayscale prefs live in Appearance", () => {
		expect(meSettingsHomeForPref("profilePortraitGrayscaleUntilHover")).toBe(
			"/me/settings/appearance",
		);
		expect(meSettingsHomeForPref("catalogMonochromePeersOnHover")).toBe(
			"/me/settings/appearance",
		);
		expect(meSettingsHomeForPref("castCrewMonochromeOnHover")).toBe(
			"/me/settings/appearance",
		);
	});

	test("adult content stays in Catalogue", () => {
		expect(meSettingsHomeForPref("showAdultContent")).toBe(
			"/me/settings/catalogue",
		);
	});

	test("IA map matches helpers", () => {
		expect(ME_SETTINGS_PREF_HOME.catalogMonochromePeersOnHover).toBe(
			"/me/settings/appearance",
		);
		expect(ME_SETTINGS_PREF_HOME.showAdultContent).toBe(
			"/me/settings/catalogue",
		);
	});
});
