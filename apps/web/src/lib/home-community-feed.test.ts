import { describe, expect, test } from "bun:test";

import {
	isHomeLeaderboardFeed,
	parseHomeCommunityFeed,
	parseHomeCommunityRankKind,
} from "./home-community-feed";

describe("parseHomeCommunityFeed", () => {
	test("ranks feed", () => {
		expect(parseHomeCommunityFeed("ranks")).toBe("ranks");
		expect(parseHomeCommunityFeed("rank")).toBe("ranks");
	});

	test("legacy rank feeds normalize to ranks", () => {
		expect(parseHomeCommunityFeed("film-ranks")).toBe("ranks");
		expect(parseHomeCommunityFeed("tv-ranks")).toBe("ranks");
		expect(parseHomeCommunityFeed("films")).toBe("ranks");
	});
});

describe("parseHomeCommunityRankKind", () => {
	test("rank param", () => {
		expect(parseHomeCommunityRankKind("tv", "ranks")).toBe("tv");
		expect(parseHomeCommunityRankKind(null, "ranks")).toBe("films");
	});

	test("legacy sort implies kind", () => {
		expect(parseHomeCommunityRankKind(null, "film-ranks")).toBe("films");
		expect(parseHomeCommunityRankKind(null, "tv-ranks")).toBe("tv");
	});
});

describe("isHomeLeaderboardFeed", () => {
	test("true for ranks", () => {
		expect(isHomeLeaderboardFeed("ranks")).toBe(true);
		expect(isHomeLeaderboardFeed("lists")).toBe(false);
	});
});
