import { describe, expect, test } from "bun:test";

import { inferAnimatedFromProfileUrl } from "./profile-media";

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
