import { describe, expect, test } from "bun:test";

import { tasteSuggestedPatronMetaLine } from "./taste-suggested-patrons";

describe("tasteSuggestedPatronMetaLine", () => {
	test("formats match percent, shared titles, and genre phrase", () => {
		expect(
			tasteSuggestedPatronMetaLine({
				userId: "u1",
				handle: "ada",
				displayName: "Ada",
				image: null,
				compatibilityPercent: 72,
				sharedWatches: 14,
				sharedGenrePhrase: "drama and thriller",
			}),
		).toBe("72% taste match · 14 shared titles · drama and thriller");
	});
});
