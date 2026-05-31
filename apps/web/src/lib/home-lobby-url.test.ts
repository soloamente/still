import { describe, expect, test } from "bun:test";
import { isBareHomeLobbySearchParams } from "./home-lobby-cookie";
import { buildHomeLobbyHref } from "./home-lobby-url";

describe("buildHomeLobbyHref", () => {
	test("Latest chip includes sort=latest so bare /home does not restore Popular from cookie", () => {
		expect(buildHomeLobbyHref({ browse: "movies", sort: "latest" })).toBe(
			"/home?sort=latest",
		);
		expect(isBareHomeLobbySearchParams({ sort: "latest" })).toBe(false);
	});

	test("Popular still serializes sort=popular", () => {
		expect(buildHomeLobbyHref({ browse: "movies", sort: "popular" })).toBe(
			"/home?sort=popular",
		);
	});

	test("Community activity preserves non-default period", () => {
		expect(
			buildHomeLobbyHref({
				browse: "community",
				sort: "activity",
				period: "week",
			}),
		).toBe("/home?browse=community&sort=activity&period=week");
	});

	test("TV seasonal anime serializes animeSeason=1", () => {
		expect(
			buildHomeLobbyHref({
				browse: "tv",
				sort: "popular",
				animeSeason: true,
			}),
		).toBe("/home?browse=tv&sort=popular&animeSeason=1");
	});
});
