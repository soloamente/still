import { describe, expect, test } from "bun:test";

import { normalizeWikidataPersonAwardBindings } from "./wikidata-person-awards";

describe("normalizeWikidataPersonAwardBindings", () => {
	test("maps won row with movie work + year", () => {
		const rows = normalizeWikidataPersonAwardBindings([
			{
				awardLabel: { value: "Academy Award for Best Actor" },
				status: { value: "won" },
				year: { value: "1995-01-01T00:00:00Z" },
				workLabel: { value: "Forrest Gump" },
				workTmdbMovie: { value: "13" },
			},
		]);
		expect(rows).toEqual([
			{
				awardLabel: "Academy Award for Best Actor",
				status: "won",
				year: 1995,
				workTitle: "Forrest Gump",
				workTmdbId: 13,
				workMediaKind: "movie",
			},
		]);
	});

	test("prefers TV TMDb id and skips invalid status", () => {
		const rows = normalizeWikidataPersonAwardBindings([
			{
				awardLabel: { value: "Emmy Award" },
				status: { value: "nominated" },
				workLabel: { value: "Chernobyl" },
				workTmdbTv: { value: "87108" },
			},
			{
				awardLabel: { value: "Junk" },
				status: { value: "maybe" },
			},
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			status: "nominated",
			workTmdbId: 87108,
			workMediaKind: "tv",
		});
	});
});
