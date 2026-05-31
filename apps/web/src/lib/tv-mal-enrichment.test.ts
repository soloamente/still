import { describe, expect, test } from "bun:test";

import { formatTvMalEnrichmentLine } from "./tv-mal-enrichment";

describe("formatTvMalEnrichmentLine", () => {
	test("joins score, rank, popularity, and status", () => {
		expect(
			formatTvMalEnrichmentLine({
				malId: 5114,
				score: 9.12,
				rank: 1,
				popularity: 25,
				status: "Finished Airing",
			}),
		).toBe("MAL · 9.12 · #1 ranked · #25 popular · Finished Airing");
	});

	test("returns null when only malId is present", () => {
		expect(
			formatTvMalEnrichmentLine({
				malId: 5114,
				score: null,
				rank: null,
				popularity: null,
				status: null,
			}),
		).toBeNull();
	});
});
