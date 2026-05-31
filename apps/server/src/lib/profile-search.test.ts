import { describe, expect, test } from "bun:test";

import {
	normalizeProfileSearchQuery,
	rankProfileSearchHits,
	relationshipFromFollow,
} from "./profile-search";

describe("normalizeProfileSearchQuery", () => {
	test("lowercases and strips @", () => {
		expect(normalizeProfileSearchQuery("@Ada")).toBe("ada");
	});
});

describe("relationshipFromFollow", () => {
	test("mutual when following and isMutual", () => {
		expect(relationshipFromFollow(true, true)).toBe("mutual");
	});
	test("following when not mutual", () => {
		expect(relationshipFromFollow(true, false)).toBe("following");
	});
	test("none when not following", () => {
		expect(relationshipFromFollow(false, false)).toBe("none");
	});
});

describe("rankProfileSearchHits", () => {
	const rows = [
		{
			userId: "1",
			handle: "stranger",
			displayName: "Stranger",
			image: null,
			isFollowing: false,
			isMutual: false,
		},
		{
			userId: "2",
			handle: "ada",
			displayName: "Ada Lovelace",
			image: null,
			isFollowing: true,
			isMutual: false,
		},
		{
			userId: "3",
			handle: "adam",
			displayName: "Adam",
			image: null,
			isFollowing: false,
			isMutual: false,
		},
	];

	test("following ranks above strangers for same prefix", () => {
		const ranked = rankProfileSearchHits(rows, "ad");
		expect(ranked[0]?.handle).toBe("ada");
		expect(ranked.some((r) => r.handle === "stranger")).toBe(false);
	});

	test("handle prefix ranks before display-name substring", () => {
		const ranked = rankProfileSearchHits(
			[
				{
					userId: "4",
					handle: "zzz",
					displayName: "Madame Ada",
					image: null,
					isFollowing: false,
					isMutual: false,
				},
				...rows.filter((r) => r.handle === "ada"),
			],
			"ada",
		);
		expect(ranked[0]?.handle).toBe("ada");
	});
});
