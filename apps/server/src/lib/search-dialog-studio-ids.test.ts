import { describe, expect, test } from "bun:test";

import { SEARCH_DIALOG_STUDIO_IDS } from "./search-dialog-studio-ids";

describe("SEARCH_DIALOG_STUDIO_IDS", () => {
	test("includes a broad curated rail (not just six tiles)", () => {
		expect(SEARCH_DIALOG_STUDIO_IDS.length).toBeGreaterThanOrEqual(70);
	});

	test("ids are unique", () => {
		expect(new Set(SEARCH_DIALOG_STUDIO_IDS).size).toBe(
			SEARCH_DIALOG_STUDIO_IDS.length,
		);
	});
});
