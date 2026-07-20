import { describe, expect, test } from "bun:test";

import {
	buildPersonAwardRows,
	personAwardWorkHref,
	pickPersonAwardTeaserWins,
} from "./person-awards";

describe("buildPersonAwardRows", () => {
	test("sorts wins before nominations, prestige then year desc", () => {
		const rows = buildPersonAwardRows([
			{
				awardLabel: "Critics Choice",
				status: "won",
				year: 2020,
				workTitle: null,
				workTmdbId: null,
				workMediaKind: null,
			},
			{
				awardLabel: "Academy Award for Best Actor",
				status: "won",
				year: 1995,
				workTitle: "Forrest Gump",
				workTmdbId: 13,
				workMediaKind: "movie",
			},
			{
				awardLabel: "Academy Award for Best Actor",
				status: "nominated",
				year: 2001,
				workTitle: "Cast Away",
				workTmdbId: 8358,
				workMediaKind: "movie",
			},
		]);
		expect(rows.map((r) => r.status)).toEqual(["won", "won", "nominated"]);
		expect(rows[0]?.icon).toBe("oscars");
		expect(rows[0]?.year).toBe(1995);
	});

	test("ranks Oscar wins above Cannes/Critics wins (person prestige, not film order)", () => {
		const rows = buildPersonAwardRows([
			{
				awardLabel: "Cannes Film Festival - Best Actor",
				status: "won",
				year: 2022,
				workTitle: "Festival Film",
				workTmdbId: 100,
				workMediaKind: "movie",
			},
			{
				awardLabel: "Critics Choice Award",
				status: "won",
				year: 2021,
				workTitle: null,
				workTmdbId: null,
				workMediaKind: null,
			},
			{
				awardLabel: "Academy Award for Best Actor",
				status: "won",
				year: 1995,
				workTitle: "Forrest Gump",
				workTmdbId: 13,
				workMediaKind: "movie",
			},
		]);
		expect(rows.map((r) => r.icon)).toEqual(["oscars", "cannes", "award"]);
		expect(rows[0]?.year).toBe(1995);
	});
});

describe("pickPersonAwardTeaserWins", () => {
	test("returns at most three wins and ignores nominations", () => {
		const rows = buildPersonAwardRows([
			{
				awardLabel: "Academy Award for Best Actor",
				status: "won",
				year: 1995,
				workTitle: "A",
				workTmdbId: 1,
				workMediaKind: "movie",
			},
			{
				awardLabel: "BAFTA Award",
				status: "won",
				year: 1995,
				workTitle: "B",
				workTmdbId: 2,
				workMediaKind: "movie",
			},
			{
				awardLabel: "Golden Globe",
				status: "won",
				year: 1995,
				workTitle: "C",
				workTmdbId: 3,
				workMediaKind: "movie",
			},
			{
				awardLabel: "SAG Award",
				status: "won",
				year: 1994,
				workTitle: "D",
				workTmdbId: 4,
				workMediaKind: "movie",
			},
			{
				awardLabel: "Oscar",
				status: "nominated",
				year: 2001,
				workTitle: "E",
				workTmdbId: 5,
				workMediaKind: "movie",
			},
		]);
		const teaser = pickPersonAwardTeaserWins(rows);
		expect(teaser).toHaveLength(3);
		expect(teaser.every((r) => r.status === "won")).toBe(true);
	});
});

describe("personAwardWorkHref", () => {
	test("builds movie and tv hrefs", () => {
		expect(
			personAwardWorkHref({
				id: "1",
				awardLabel: "x",
				status: "won",
				year: 2000,
				workTitle: "Film",
				workTmdbId: 13,
				workMediaKind: "movie",
				icon: "oscars",
			}),
		).toBe("/movies/13");
		expect(
			personAwardWorkHref({
				id: "2",
				awardLabel: "x",
				status: "won",
				year: 2000,
				workTitle: "Show",
				workTmdbId: 87108,
				workMediaKind: "tv",
				icon: "award",
			}),
		).toBe("/tv/87108");
		expect(
			personAwardWorkHref({
				id: "3",
				awardLabel: "x",
				status: "won",
				year: null,
				workTitle: "Unknown",
				workTmdbId: null,
				workMediaKind: null,
				icon: "award",
			}),
		).toBeNull();
	});
});
