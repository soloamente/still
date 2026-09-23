import { describe, expect, test } from "bun:test";

import {
	pickMostUsedDarkRgbFromRgba,
	rgbChroma,
	rgbLuminance,
	SEARCH_DIALOG_PEOPLE_SCRIM_FALLBACK_RGB,
	searchDialogPeoplePortraitScrimStyle,
	searchDialogPeopleScrimSampleSrc,
} from "./search-dialog-people-portrait-scrim";

describe("searchDialogPeoplePortraitScrimStyle", () => {
	test("fades sampled color up to transparent", () => {
		const style = searchDialogPeoplePortraitScrimStyle("rgb(120, 40, 60)");
		expect(style.backgroundImage).toContain("linear-gradient(to top");
		expect(style.backgroundImage).toContain("rgb(120, 40, 60)");
		expect(style.backgroundImage).toContain("transparent");
	});

	test("falls back to black when no sample exists", () => {
		const style = searchDialogPeoplePortraitScrimStyle(null);
		expect(style.backgroundImage).toContain(
			SEARCH_DIALOG_PEOPLE_SCRIM_FALLBACK_RGB,
		);
	});
});

describe("searchDialogPeopleScrimSampleSrc", () => {
	test("routes remote https through the Next image optimizer", () => {
		const src = searchDialogPeopleScrimSampleSrc(
			"https://image.tmdb.org/t/p/w185/abc.jpg",
		);
		expect(src.startsWith("/_next/image?")).toBe(true);
		expect(src).toContain("w=96");
		expect(src).toContain("q=75");
		expect(src).toContain(encodeURIComponent("https://image.tmdb.org/t/p/w185/abc.jpg"));
	});

	test("leaves non-http urls alone", () => {
		expect(searchDialogPeopleScrimSampleSrc("/local.png")).toBe("/local.png");
	});
});

describe("pickMostUsedDarkRgbFromRgba", () => {
	test("prefers a chromatic dark swatch over crushed black", () => {
		// Many near-black greys + fewer deep burgundy — burgundy should win.
		const pixels: number[] = [];
		for (let i = 0; i < 12; i += 1) {
			pixels.push(8, 8, 8, 255);
		}
		for (let i = 0; i < 5; i += 1) {
			pixels.push(90, 28, 48, 255);
		}
		const rgb = pickMostUsedDarkRgbFromRgba(new Uint8ClampedArray(pixels));
		expect(rgb).not.toBeNull();
		const match = rgb?.match(/rgb\((\d+), (\d+), (\d+)\)/);
		expect(match).toBeTruthy();
		const r = Number(match?.[1]);
		const g = Number(match?.[2]);
		const b = Number(match?.[3]);
		expect(rgbChroma(r, g, b)).toBeGreaterThan(20);
		expect(r).toBeGreaterThan(g);
		expect(rgbLuminance(r, g, b)).toBeLessThan(160);
	});

	test("falls back to the most chromatic mid-dark when hues are scarce", () => {
		const data = new Uint8ClampedArray([
			250, 250, 250, 255, 40, 90, 70, 255, 42, 88, 72, 255,
		]);
		const rgb = pickMostUsedDarkRgbFromRgba(data, { minChroma: 200 });
		expect(rgb).toContain("rgb(");
		expect(rgb).not.toBe(SEARCH_DIALOG_PEOPLE_SCRIM_FALLBACK_RGB);
	});
});
