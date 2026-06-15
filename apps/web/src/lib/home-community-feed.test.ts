import { describe, expect, test } from "bun:test";

import {
	homeCommunityRankKindLabel,
	isFilmTvRankKind,
	isHomeLeaderboardFeed,
	isMembersRankKind,
	parseHomeCommunityFeed,
	parseHomeCommunityRankKind,
} from "./home-community-feed";

describe("parseHomeCommunityFeed", () => {
	test("ranks feed", () => {
		expect(parseHomeCommunityFeed("ranks")).toBe("ranks");
		expect(parseHomeCommunityFeed("rank")).toBe("ranks");
	});

	test("legacy members sort maps to ranks", () => {
		expect(parseHomeCommunityFeed("members")).toBe("ranks");
		expect(parseHomeCommunityFeed("member")).toBe("ranks");
	});

	test("legacy rank feeds normalize to ranks", () => {
		expect(parseHomeCommunityFeed("film-ranks")).toBe("ranks");
		expect(parseHomeCommunityFeed("tv-ranks")).toBe("ranks");
		expect(parseHomeCommunityFeed("films")).toBe("ranks");
	});
});

describe("parseHomeCommunityRankKind", () => {
	test("film and show diary boards", () => {
		expect(parseHomeCommunityRankKind("tv", "ranks")).toBe("tv");
		expect(parseHomeCommunityRankKind(null, "ranks")).toBe("films");
	});

	test("patron contribution sorts via rank param", () => {
		expect(parseHomeCommunityRankKind("popular", "ranks")).toBe("reviews");
		expect(parseHomeCommunityRankKind("likes", "ranks")).toBe("reviews");
		expect(parseHomeCommunityRankKind("lists", "ranks")).toBe("reviews");
		expect(parseHomeCommunityRankKind("reviews", "ranks")).toBe("reviews");
	});

	test("legacy members feed uses memberSort", () => {
		expect(parseHomeCommunityRankKind(null, "members", "reviews")).toBe(
			"reviews",
		);
		expect(parseHomeCommunityRankKind(null, "members")).toBe("reviews");
		expect(parseHomeCommunityRankKind(null, "members", "popular")).toBe(
			"reviews",
		);
		expect(parseHomeCommunityRankKind(null, "members", "likes")).toBe(
			"reviews",
		);
	});
});

describe("homeCommunityRankKindLabel", () => {
	test("patron-facing labels", () => {
		expect(homeCommunityRankKindLabel("films")).toBe("Films");
		expect(homeCommunityRankKindLabel("tv")).toBe("Shows");
		expect(homeCommunityRankKindLabel("reviews")).toBe("Reviews");
	});
});

describe("rank kind guards", () => {
	test("film/tv vs members slices", () => {
		expect(isFilmTvRankKind("films")).toBe(true);
		expect(isMembersRankKind("reviews")).toBe(true);
		expect(isMembersRankKind("films")).toBe(false);
		expect(isMembersRankKind("tv")).toBe(false);
	});

	test("isHomeLeaderboardFeed", () => {
		expect(isHomeLeaderboardFeed("ranks")).toBe(true);
		expect(isHomeLeaderboardFeed("lists")).toBe(false);
	});
});
