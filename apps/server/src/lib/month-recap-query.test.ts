import { describe, expect, test } from "bun:test";

import type { DiaryMetalTier } from "./diary-metal-tier";
import {
	buildMonthRecapCategories,
	type MonthRecapEntry,
} from "./month-recap-query";

function entry(rank: number): MonthRecapEntry {
	return {
		rank,
		userId: `user-${rank}`,
		handle: `patron${rank}`,
		displayName: `Patron ${rank}`,
		image: null,
		avatarIsAnimated: false,
		diaryMetalTier: null satisfies DiaryMetalTier | null,
		count: 10 - rank,
	};
}

describe("buildMonthRecapCategories", () => {
	test("omits categories with no entries", () => {
		const categories = buildMonthRecapCategories([
			{ id: "films", title: "Most films watched", entries: [] },
			{ id: "tv", title: "Most TV watched", entries: [entry(1)] },
			{
				id: "reviews",
				title: "Most reviews published",
				entries: [entry(1), entry(2)],
			},
		]);

		expect(categories).toHaveLength(2);
		expect(categories.map((c) => c.id)).toEqual(["tv", "reviews"]);
		expect(categories[0]?.entries).toHaveLength(1);
		expect(categories[1]?.entries).toHaveLength(2);
	});

	test("returns empty array when every category is empty", () => {
		expect(
			buildMonthRecapCategories([
				{ id: "films", title: "Most films watched", entries: [] },
				{ id: "tv", title: "Most TV watched", entries: [] },
				{ id: "reviews", title: "Most reviews published", entries: [] },
			]),
		).toEqual([]);
	});
});
