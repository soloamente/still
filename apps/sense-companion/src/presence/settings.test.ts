import { describe, expect, test } from "bun:test";

import netflixMetadata from "../../vendor/premid-activities/websites/N/Netflix/metadata.json";
import {
	customizableSettings,
	mergeSettingOverrides,
	parseStoredSettings,
	settingDefaults,
	settingIsVisible,
} from "./settings.ts";
import { readActivitySettings } from "./sites.ts";

const netflixSettings = readActivitySettings(netflixMetadata.settings);

describe("settingDefaults", () => {
	test("uses metadata values and English for the language setting", () => {
		const defaults = settingDefaults(netflixSettings);

		expect(defaults.lang).toBe("en");
		expect(defaults.privacy).toBe(false);
		expect(defaults.timestamp).toBe(true);
		expect(defaults.showSeries).toBe(true);
		expect(defaults.showMovies).toBe(true);
		expect(defaults.logoType).toBe(0);
	});
});

describe("customizable settings", () => {
	test("hides the language row and privacy-only rows", () => {
		const values = settingDefaults(netflixSettings);
		const visible = customizableSettings(netflixSettings).filter((setting) =>
			settingIsVisible(setting, values),
		);
		const ids = visible.map((setting) => setting.id);

		expect(ids).not.toContain("lang");
		expect(ids).toContain("privacy");
		expect(ids).toContain("usePresenceName");
		expect(ids).toContain("logoType");

		const privateValues = { ...values, privacy: true };
		const whilePrivate = customizableSettings(netflixSettings).filter(
			(setting) => settingIsVisible(setting, privateValues),
		);
		expect(whilePrivate.map((setting) => setting.id)).not.toContain(
			"usePresenceName",
		);
	});

	test("keeps a saved boolean and drops a wrong type", () => {
		const defaults = settingDefaults(netflixSettings);
		const merged = mergeSettingOverrides(defaults, {
			privacy: true,
			logoType: "still",
			unknown: true,
		});

		expect(merged.privacy).toBe(true);
		expect(merged.logoType).toBe(0);
		expect(merged.unknown).toBeUndefined();
	});

	test("reads only known services from storage", () => {
		expect(
			parseStoredSettings({
				netflix: { privacy: true, logoType: 1, junk: { nested: true } },
				crunchyroll: { privacy: true },
			}),
		).toEqual({
			netflix: { privacy: true, logoType: 1 },
		});
	});
});
