import { describe, expect, test } from "bun:test";

import { computeOutputSize } from "./crop-image";
import { PROFILE_AVATAR_CROP_MAX_PX } from "./profile-portrait-shell";

describe("computeOutputSize", () => {
	test("returns the crop size unchanged when it fits within max", () => {
		expect(
			computeOutputSize(
				{ width: 800, height: 800 },
				PROFILE_AVATAR_CROP_MAX_PX,
			),
		).toEqual({ width: 800, height: 800 });
	});

	test("downscales preserving aspect when the crop exceeds max", () => {
		// 3000x1000 (3:1) into a 1500x500 (3:1) cap → uniform scale 0.5.
		const out = computeOutputSize(
			{ width: 3000, height: 1000 },
			{ width: 1500, height: 500 },
		);
		expect(out).toEqual({ width: 1500, height: 500 });
	});

	test("never upscales (scale capped at 1)", () => {
		expect(
			computeOutputSize(
				{ width: 100, height: 100 },
				PROFILE_AVATAR_CROP_MAX_PX,
			),
		).toEqual({ width: 100, height: 100 });
	});
});
