import { describe, expect, test } from "bun:test";

import {
	isHomeLeaderboardFeed,
	parseHomeCommunityFeed,
} from "./home-community-feed";

describe("parseHomeCommunityFeed", () => {
	test("rank feeds", () => {
		expect(parseHomeCommunityFeed("film-ranks")).toBe("film-ranks");
		expect(parseHomeCommunityFeed("tv-ranks")).toBe("tv-ranks");
	});

	test("legacy aliases", () => {
		expect(parseHomeCommunityFeed("films")).toBe("film-ranks");
	});
});

describe("isHomeLeaderboardFeed", () => {
	test("true for rank ids", () => {
		expect(isHomeLeaderboardFeed("film-ranks")).toBe(true);
		expect(isHomeLeaderboardFeed("lists")).toBe(false);
	});
});
