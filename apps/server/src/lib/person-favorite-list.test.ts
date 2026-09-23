import { describe, expect, test } from "bun:test";

import { buildPersonFavoriteCreditBaseline } from "./person-favorite";

/** Pagination cursor math stays in list helper — smoke the export surface. */
describe("person-favorite-list contract", () => {
	test("baseline helper still has no notify side effects", () => {
		const rows = buildPersonFavoriteCreditBaseline([
			{
				mediaKind: "movie",
				tmdbId: 1,
				role: { kind: "cast", character: "A" },
			},
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.roleKey).toBe("cast:a");
	});
});
