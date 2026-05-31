import { describe, expect, test } from "bun:test";

import {
	APP_THEME_CLASS_EMBER,
	APP_THEME_CLASS_LOBBY_LIGHT,
	APP_THEME_CLASS_MIDNIGHT,
	APP_THEME_CLASS_NOIR,
	APP_THEME_CLASS_THEATER,
	APP_THEMES,
	resolveAppTheme,
	resolveAppThemeForPatron,
} from "./app-themes";

describe("APP_THEMES labels", () => {
	test("emotion-first display names (Set A)", () => {
		expect(APP_THEMES[APP_THEME_CLASS_THEATER].label).toBe("Calm");
		expect(APP_THEMES[APP_THEME_CLASS_LOBBY_LIGHT].label).toBe("Lucid");
		expect(APP_THEMES[APP_THEME_CLASS_NOIR].label).toBe("Pensive");
		expect(APP_THEMES[APP_THEME_CLASS_EMBER].label).toBe("Cozy");
		expect(APP_THEMES[APP_THEME_CLASS_MIDNIGHT].label).toBe("Dreamy");
	});
});

describe("resolveAppTheme", () => {
	test("returns theater for unknown values", () => {
		expect(resolveAppTheme(null)).toBe(APP_THEME_CLASS_THEATER);
		expect(resolveAppTheme("purple")).toBe(APP_THEME_CLASS_THEATER);
	});

	test("maps legacy next-themes ids", () => {
		expect(resolveAppTheme("dark")).toBe(APP_THEME_CLASS_THEATER);
		expect(resolveAppTheme("light")).toBe(APP_THEME_CLASS_LOBBY_LIGHT);
	});

	test("accepts palette class names", () => {
		expect(resolveAppTheme(APP_THEME_CLASS_NOIR)).toBe(APP_THEME_CLASS_NOIR);
	});

	test("resolveAppThemeForPatron strips Pro palettes for non-Pro", () => {
		expect(resolveAppThemeForPatron(APP_THEME_CLASS_EMBER, false)).toBe(
			APP_THEME_CLASS_THEATER,
		);
		expect(resolveAppThemeForPatron(APP_THEME_CLASS_EMBER, true)).toBe(
			APP_THEME_CLASS_EMBER,
		);
	});
});
