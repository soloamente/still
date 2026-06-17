import { describe, expect, test } from "bun:test";

import {
	isAnimatedGifUpload,
	mergeAvatarAnimationPref,
	PROFILE_PRIVACY_PRESENCE_VISIBILITY_FRIENDS,
	PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC,
	readAvatarIsAnimatedPref,
	readProfilePresenceVisibilityPref,
	serializePatronProfileForClient,
} from "./profile-media";

describe("isAnimatedGifUpload", () => {
	test("detects image/gif mime", () => {
		const file = { type: "image/gif", name: "x.bin" } as File;
		expect(isAnimatedGifUpload(file)).toBe(true);
	});
	test("detects .gif extension when mime is generic", () => {
		const file = { type: "image/*", name: "loop.GIF" } as File;
		expect(isAnimatedGifUpload(file)).toBe(true);
	});
	test("rejects png", () => {
		const file = { type: "image/png", name: "a.png" } as File;
		expect(isAnimatedGifUpload(file)).toBe(false);
	});
});

describe("readAvatarIsAnimatedPref", () => {
	test("defaults false", () => {
		expect(readAvatarIsAnimatedPref(null)).toBe(false);
	});
	test("reads true flag", () => {
		expect(readAvatarIsAnimatedPref({ avatarIsAnimated: true })).toBe(true);
	});
});

describe("readProfilePresenceVisibilityPref", () => {
	test("defaults to friends when missing", () => {
		expect(readProfilePresenceVisibilityPref(null)).toBe(
			PROFILE_PRIVACY_PRESENCE_VISIBILITY_FRIENDS,
		);
		expect(readProfilePresenceVisibilityPref({})).toBe(
			PROFILE_PRIVACY_PRESENCE_VISIBILITY_FRIENDS,
		);
	});

	test("returns public when explicitly configured", () => {
		expect(
			readProfilePresenceVisibilityPref({
				privacy: { presenceVisibility: "public" },
			}),
		).toBe(PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC);
	});

	test("falls back to friends for invalid values", () => {
		expect(
			readProfilePresenceVisibilityPref({
				privacy: { presenceVisibility: "everyone" },
			}),
		).toBe(PROFILE_PRIVACY_PRESENCE_VISIBILITY_FRIENDS);
	});
});

describe("mergeAvatarAnimationPref", () => {
	test("sets true on gif upload", () => {
		expect(mergeAvatarAnimationPref({ foo: 1 }, true)).toEqual({
			foo: 1,
			avatarIsAnimated: true,
		});
	});
});

describe("serializePatronProfileForClient", () => {
	test("includes diaryMetalTier from log count", () => {
		expect(
			serializePatronProfileForClient(
				{ handle: "a", displayName: "A", preferences: {} },
				150,
			),
		).toEqual({
			handle: "a",
			displayName: "A",
			avatarIsAnimated: false,
			diaryMetalTier: "chromatic",
		});
	});

	test("null tier below threshold", () => {
		expect(
			serializePatronProfileForClient(
				{ handle: "b", displayName: "B", preferences: {} },
				12,
			)?.diaryMetalTier,
		).toBeNull();
	});
});
