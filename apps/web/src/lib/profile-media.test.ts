import { describe, expect, test } from "bun:test";

import {
	assertProfilePortraitUploadAllowed,
	inferAnimatedFromProfileUrl,
	isAnimatedGifUpload,
	PRO_ANIMATED_PORTRAIT_MESSAGE,
} from "./profile-media";

describe("isAnimatedGifUpload", () => {
	test("detects image/gif mime", () => {
		const file = { type: "image/gif", name: "x.bin" } as File;
		expect(isAnimatedGifUpload(file)).toBe(true);
	});

	test("detects .gif extension", () => {
		const file = { type: "image/png", name: "loop.GIF" } as File;
		expect(isAnimatedGifUpload(file)).toBe(true);
	});

	test("returns false for static images", () => {
		const file = { type: "image/png", name: "still.png" } as File;
		expect(isAnimatedGifUpload(file)).toBe(false);
	});
});

describe("assertProfilePortraitUploadAllowed", () => {
	test("allows GIF when patron is Pro", () => {
		const file = { type: "image/gif", name: "loop.gif" } as File;
		expect(() => assertProfilePortraitUploadAllowed(file, true)).not.toThrow();
	});

	test("blocks GIF when patron is not Pro", () => {
		const file = { type: "image/gif", name: "loop.gif" } as File;
		expect(() => assertProfilePortraitUploadAllowed(file, false)).toThrow(
			PRO_ANIMATED_PORTRAIT_MESSAGE,
		);
	});
});

describe("inferAnimatedFromProfileUrl", () => {
	test("returns true when flag is true", () => {
		expect(inferAnimatedFromProfileUrl("https://x.test/a.png", true)).toBe(
			true,
		);
	});

	test("returns false when flag is false", () => {
		expect(inferAnimatedFromProfileUrl("https://x.test/loop.gif", false)).toBe(
			false,
		);
	});

	test("returns false when flag is undefined and url is empty", () => {
		expect(inferAnimatedFromProfileUrl(null, undefined)).toBe(false);
		expect(inferAnimatedFromProfileUrl("  ", undefined)).toBe(false);
	});

	test("infers true from .gif URL when flag is undefined", () => {
		expect(
			inferAnimatedFromProfileUrl("https://blob.test/avatar.gif", undefined),
		).toBe(true);
		expect(
			inferAnimatedFromProfileUrl(
				"https://blob.test/avatar.gif?v=1",
				undefined,
			),
		).toBe(true);
	});

	test("infers false from non-gif URL when flag is undefined", () => {
		expect(
			inferAnimatedFromProfileUrl("https://blob.test/avatar.png", undefined),
		).toBe(false);
	});
});
