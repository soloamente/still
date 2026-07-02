import { describe, expect, test } from "bun:test";

import { r2KeyCandidates } from "./r2-dev-assets";

describe("r2KeyCandidates", () => {
	test("includes double-encoded space variant for legacy banner keys", () => {
		const key = "banners/u1/1782866452537-giphy%20(2).gif";
		expect(r2KeyCandidates(key)).toContain(
			"banners/u1/1782866452537-giphy%2520(2).gif",
		);
	});
});
