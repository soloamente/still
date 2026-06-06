import { describe, expect, test } from "bun:test";
import {
	hasActiveHomeCatalogFilters,
	mergeHomeCatalogFiltersIntoHref,
	parseHomeCatalogFilters,
	stripIncompatibleHomeCatalogFilters,
} from "./home-catalog-filters";
import { buildHomeLobbyHref } from "./home-lobby-url";

describe("parseHomeCatalogFilters", () => {
	test("parses genre and monetization", () => {
		const params = new URLSearchParams(
			"sort=popular&venue=streaming&genre=28&monetization=rent",
		);

		expect(
			parseHomeCatalogFilters(params, { venue: "streaming", sort: "popular" }),
		).toEqual({
			genreId: 28,

			monetization: "rent",
		});
	});

	test("strips monetization on theaters venue", () => {
		const params = new URLSearchParams(
			"sort=popular&venue=theaters&genre=28&monetization=rent",
		);

		expect(
			parseHomeCatalogFilters(params, { venue: "theaters", sort: "popular" }),
		).toEqual({
			genreId: 28,

			monetization: null,
		});
	});
});

describe("hasActiveHomeCatalogFilters", () => {
	test("false when defaults only", () => {
		expect(
			hasActiveHomeCatalogFilters({
				genreId: null,

				monetization: null,
			}),
		).toBe(false);
	});

	test("true when genre set", () => {
		expect(
			hasActiveHomeCatalogFilters({
				genreId: 28,

				monetization: null,
			}),
		).toBe(true);
	});
});

describe("mergeHomeCatalogFiltersIntoHref", () => {
	test("adds genre to home href", () => {
		const href = mergeHomeCatalogFiltersIntoHref(
			"/home?sort=popular&venue=theaters",

			{
				genreId: 28,

				monetization: null,
			},
		);

		expect(href).toContain("genre=28");
	});

	test("clears filters when all null", () => {
		const href = mergeHomeCatalogFiltersIntoHref(
			"/home?sort=popular&venue=theaters&genre=28",

			{ genreId: null, monetization: null },
		);

		expect(href).not.toContain("genre=");
	});

	test("strips legacy discoverSort param", () => {
		const href = mergeHomeCatalogFiltersIntoHref(
			"/home?sort=popular&venue=theaters&discoverSort=vote_average.desc&genre=28",

			{ genreId: 28, monetization: null },
		);

		expect(href).not.toContain("discoverSort=");

		expect(href).toContain("genre=28");
	});
});

describe("stripIncompatibleHomeCatalogFilters", () => {
	test("drops monetization when switching to theaters", () => {
		expect(
			stripIncompatibleHomeCatalogFilters(
				{
					genreId: 28,

					monetization: "rent",
				},

				{ venue: "theaters", sort: "popular" },
			),
		).toEqual({
			genreId: 28,

			monetization: null,
		});
	});
});

describe("buildHomeLobbyHref filter params", () => {
	test("serializes genre", () => {
		expect(
			buildHomeLobbyHref({
				browse: "movies",

				sort: "popular",

				venue: "theaters",

				genreId: 28,
			}),
		).toBe("/home?sort=popular&venue=theaters&genre=28");
	});
});
