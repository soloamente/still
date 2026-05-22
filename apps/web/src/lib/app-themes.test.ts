import { describe, expect, test } from "bun:test";

import {
	APP_THEME_CLASS_LOBBY_LIGHT,
	APP_THEME_CLASS_NOIR,
	APP_THEME_CLASS_THEATER,
	resolveAppTheme,
} from "./app-themes";

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
});
