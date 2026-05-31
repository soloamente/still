import { describe, expect, test } from "bun:test";

import {
	ANIME_SEASON_ROLLING_DAYS,
	ANIME_TV_GENRE_ID,
	animeSeasonRollingAirDateFloorUtc,
	animeSeasonTvDiscoverParams,
	isHomeAnimeSeasonLobby,
	parseHomeAnimeSeason,
} from "./home-anime-season";

describe("parseHomeAnimeSeason", () => {
	test("accepts 1 / true / yes", () => {
		expect(parseHomeAnimeSeason("1")).toBe(true);
		expect(parseHomeAnimeSeason("true")).toBe(true);
		expect(parseHomeAnimeSeason("yes")).toBe(true);
		expect(parseHomeAnimeSeason(null)).toBe(false);
		expect(parseHomeAnimeSeason("0")).toBe(false);
	});
});

describe("animeSeasonRollingAirDateFloorUtc", () => {
	test("subtracts rolling window in UTC days", () => {
		const floor = animeSeasonRollingAirDateFloorUtc(
			new Date("2026-05-29T12:00:00.000Z"),
		);
		expect(floor).toBe("2026-02-28");
		expect(ANIME_SEASON_ROLLING_DAYS).toBe(90);
	});
});

describe("animeSeasonTvDiscoverParams", () => {
	test("uses animation genre, returning status, and rolling air floor", () => {
		const params = animeSeasonTvDiscoverParams("popular");
		expect(params.genreId).toBe(ANIME_TV_GENRE_ID);
		expect(params.status).toBe("returning");
		expect(params.sortBy).toBe("popularity.desc");
		expect(params.airDateGte).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe("isHomeAnimeSeasonLobby", () => {
	test("only active on TV browse with flag", () => {
		expect(isHomeAnimeSeasonLobby({ browse: "tv", animeSeason: true })).toBe(
			true,
		);
		expect(
			isHomeAnimeSeasonLobby({ browse: "movies", animeSeason: true }),
		).toBe(false);
	});
});
