import { describe, expect, test } from "bun:test";

import { isWranglerR2KeyCandidateSafe, r2KeyCandidates } from "./r2-dev-assets";

describe("r2KeyCandidates", () => {
	test("includes double-encoded space variant for legacy banner keys", () => {
		const key = "banners/u1/1782866452537-giphy%20(2).gif";
		expect(r2KeyCandidates(key)).toContain(
			"banners/u1/1782866452537-giphy%2520(2).gif",
		);
	});

	test("includes encoded-parenthesis variant for legacy avatar keys", () => {
		const key = "avatars/u1/1782862933417-Download%20(44).jpg";
		expect(r2KeyCandidates(key)).toContain(
			"avatars/u1/1782862933417-Download%20%2844%29.jpg",
		);
	});
});

describe("isWranglerR2KeyCandidateSafe", () => {
	test("rejects decoded keys with spaces or parentheses", () => {
		expect(
			isWranglerR2KeyCandidateSafe(
				"avatars/u1/1782862933417-Download (44).jpg",
			),
		).toBe(false);
	});

	test("allows percent-encoded keys", () => {
		expect(
			isWranglerR2KeyCandidateSafe(
				"avatars/u1/1782862933417-Download%20(44).jpg",
			),
		).toBe(true);
	});
});
