import { describe, expect, test } from "bun:test";

import {
	APP_THEME_CLASS_EMBER,
	APP_THEME_CLASS_LOBBY_LIGHT,
	APP_THEME_CLASS_MIDNIGHT,
	APP_THEME_CLASS_NOIR,
	APP_THEME_CLASS_THEATER,
} from "@/lib/app-themes";
import {
	resolveStudioThemedLogoUrl,
	studioThemedLogoPath,
} from "@/lib/search-dialog-studio-logo";

describe("studioThemedLogoPath", () => {
	test("builds Calm theater path", () => {
		expect(studioThemedLogoPath("a24", APP_THEME_CLASS_THEATER)).toBe(
			"/studios/a24/a24_theater.png",
		);
	});

	test("builds Lucid path", () => {
		expect(studioThemedLogoPath("a24", APP_THEME_CLASS_LOBBY_LIGHT)).toBe(
			"/studios/a24/a24_lucid.png",
		);
	});
});

describe("resolveStudioThemedLogoUrl", () => {
	test("returns A24 themed url for known id", () => {
		expect(resolveStudioThemedLogoUrl(41077, APP_THEME_CLASS_THEATER)).toBe(
			"/studios/a24/a24_theater.png",
		);
	});

	test("returns NEON themed url for known id", () => {
		expect(resolveStudioThemedLogoUrl(90733, APP_THEME_CLASS_EMBER)).toBe(
			"/studios/neon/neon_cozy.png",
		);
	});

	test("returns Focus themed url for known id", () => {
		expect(resolveStudioThemedLogoUrl(10146, APP_THEME_CLASS_LOBBY_LIGHT)).toBe(
			"/studios/focus/focus_lucid.png",
		);
	});

	test("returns Sony themed urls for every palette", () => {
		expect(resolveStudioThemedLogoUrl(34, APP_THEME_CLASS_THEATER)).toBe(
			"/studios/sony/sony_theater.png",
		);
		expect(resolveStudioThemedLogoUrl(34, APP_THEME_CLASS_LOBBY_LIGHT)).toBe(
			"/studios/sony/sony_lucid.png",
		);
		expect(resolveStudioThemedLogoUrl(34, APP_THEME_CLASS_NOIR)).toBe(
			"/studios/sony/sony_pensive.png",
		);
		expect(resolveStudioThemedLogoUrl(34, APP_THEME_CLASS_EMBER)).toBe(
			"/studios/sony/sony_cozy.png",
		);
		expect(resolveStudioThemedLogoUrl(34, APP_THEME_CLASS_MIDNIGHT)).toBe(
			"/studios/sony/sony_dreamy.png",
		);
	});

	test("returns Blumhouse themed urls for every palette", () => {
		expect(resolveStudioThemedLogoUrl(3172, APP_THEME_CLASS_THEATER)).toBe(
			"/studios/blumhouse/blumhouse_theater.png",
		);
		expect(resolveStudioThemedLogoUrl(3172, APP_THEME_CLASS_LOBBY_LIGHT)).toBe(
			"/studios/blumhouse/blumhouse_lucid.png",
		);
		expect(resolveStudioThemedLogoUrl(3172, APP_THEME_CLASS_NOIR)).toBe(
			"/studios/blumhouse/blumhouse_pensive.png",
		);
		expect(resolveStudioThemedLogoUrl(3172, APP_THEME_CLASS_EMBER)).toBe(
			"/studios/blumhouse/blumhouse_cozy.png",
		);
		expect(resolveStudioThemedLogoUrl(3172, APP_THEME_CLASS_MIDNIGHT)).toBe(
			"/studios/blumhouse/blumhouse_dreamy.png",
		);
	});

	test("returns Annapurna themed urls for every palette", () => {
		expect(resolveStudioThemedLogoUrl(13184, APP_THEME_CLASS_THEATER)).toBe(
			"/studios/annapurna/annapurna_theater.png",
		);
		expect(resolveStudioThemedLogoUrl(13184, APP_THEME_CLASS_LOBBY_LIGHT)).toBe(
			"/studios/annapurna/annapurna_lucid.png",
		);
		expect(resolveStudioThemedLogoUrl(13184, APP_THEME_CLASS_NOIR)).toBe(
			"/studios/annapurna/annapurna_pensive.png",
		);
		expect(resolveStudioThemedLogoUrl(13184, APP_THEME_CLASS_EMBER)).toBe(
			"/studios/annapurna/annapurna_cozy.png",
		);
		expect(resolveStudioThemedLogoUrl(13184, APP_THEME_CLASS_MIDNIGHT)).toBe(
			"/studios/annapurna/annapurna_dreamy.png",
		);
	});

	test("returns null for studios without hosted assets", () => {
		expect(resolveStudioThemedLogoUrl(58, APP_THEME_CLASS_THEATER)).toBeNull();
	});
});
