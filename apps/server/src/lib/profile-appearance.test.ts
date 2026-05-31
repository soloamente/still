import { describe, expect, test } from "bun:test";

import {
	isProfileAccentId,
	isProfileBannerFrameId,
	profileAccentHex,
} from "./profile-appearance";

describe("profile-appearance", () => {
	test("validates accent and banner frame ids", () => {
		expect(isProfileAccentId("desert")).toBe(true);
		expect(isProfileAccentId("invalid")).toBe(false);
		expect(isProfileBannerFrameId("cinema")).toBe(true);
		expect(isProfileBannerFrameId("none")).toBe(true);
	});

	test("profileAccentHex maps presets", () => {
		expect(profileAccentHex("copper")).toBe("#b75928");
	});
});
