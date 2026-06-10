import { describe, expect, test } from "bun:test";

import {
	DIARY_METAL_BORDER_BEAM_STRENGTH,
	diaryMetalBorderBeamColorVariant,
	isCircularPatronPortraitClass,
} from "./diary-metal-tier";

describe("diary-metal-tier", () => {
	test("border beam color maps diary volume tier to palette", () => {
		expect(diaryMetalBorderBeamColorVariant("silver")).toBe("mono");
		expect(diaryMetalBorderBeamColorVariant("gold")).toBe("sunset");
		expect(diaryMetalBorderBeamColorVariant("chromatic")).toBe("colorful");
	});

	test("border beam strength is always full", () => {
		expect(DIARY_METAL_BORDER_BEAM_STRENGTH).toBe(1);
	});

	test("isCircularPatronPortraitClass rejects rounded poster frames", () => {
		expect(isCircularPatronPortraitClass("size-full rounded-full")).toBe(true);
		expect(isCircularPatronPortraitClass("size-full rounded-2xl")).toBe(false);
	});
});
