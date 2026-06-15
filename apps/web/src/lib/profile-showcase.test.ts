import { describe, expect, test } from "bun:test";

import {
	appendShowcaseItem,
	isShowcaseItemPresent,
	parseProfileShowcaseResolved,
	parseShowcaseItemsFromProfile,
	showcaseFilledCount,
	showcaseItemKey,
	tilesToShowcaseItems,
} from "./profile-showcase";

describe("showcaseFilledCount", () => {
	test("counts filled slots", () => {
		expect(showcaseFilledCount([])).toBe(0);
		expect(showcaseFilledCount([{ kind: "movie", id: 1 }])).toBe(1);
		expect(
			showcaseFilledCount([
				{ kind: "movie", id: 1 },
				{ kind: "tv", id: 2 },
				{ kind: "review", id: "abc12345" },
			]),
		).toBe(3);
	});
});

describe("showcaseItemKey", () => {
	test("builds stable keys", () => {
		expect(showcaseItemKey({ kind: "movie", id: 550 })).toBe("movie:550");
		expect(showcaseItemKey({ kind: "review", id: "rev-1" })).toBe(
			"review:rev-1",
		);
	});
});

describe("parseProfileShowcaseResolved", () => {
	test("parses hydrated tiles from API payload", () => {
		const parsed = parseProfileShowcaseResolved({
			items: [
				{
					kind: "movie",
					id: 1,
					title: "Fight Club",
					posterPath: "/abc.jpg",
					reviewHeadline: null,
				},
			],
		});
		expect(parsed.items).toHaveLength(1);
		expect(parsed.items[0]?.title).toBe("Fight Club");
	});

	test("returns empty for invalid payload", () => {
		expect(parseProfileShowcaseResolved(null).items).toEqual([]);
		expect(parseProfileShowcaseResolved({ items: "nope" }).items).toEqual([]);
	});
});

describe("tilesToShowcaseItems", () => {
	test("maps tiles to PATCH items", () => {
		expect(
			tilesToShowcaseItems([
				{
					kind: "review",
					id: "abcd1234",
					title: "A review",
					posterPath: null,
					reviewHeadline: "Headline",
				},
			]),
		).toEqual([{ kind: "review", id: "abcd1234" }]);
	});
});

describe("parseShowcaseItemsFromProfile", () => {
	test("parses raw profile showcase json", () => {
		expect(
			parseShowcaseItemsFromProfile([
				{ kind: "movie", id: 1 },
				{ kind: "review", id: "rev-1" },
			]),
		).toEqual([
			{ kind: "movie", id: 1 },
			{ kind: "review", id: "rev-1" },
		]);
	});

	test("ignores invalid rows", () => {
		expect(parseShowcaseItemsFromProfile(null)).toEqual([]);
		expect(parseShowcaseItemsFromProfile([{ kind: "nope", id: 1 }])).toEqual(
			[],
		);
	});
});

describe("appendShowcaseItem", () => {
	test("appends when room remains", () => {
		expect(appendShowcaseItem([], { kind: "review", id: "rev-1" })).toEqual([
			{ kind: "review", id: "rev-1" },
		]);
	});

	test("blocks duplicates and overflow", () => {
		const full = [
			{ kind: "movie", id: 1 },
			{ kind: "movie", id: 2 },
			{ kind: "movie", id: 3 },
			{ kind: "movie", id: 4 },
		] as const;
		expect(appendShowcaseItem(full, { kind: "movie", id: 5 })).toEqual({
			error: "You can showcase up to 4 items",
		});
		expect(
			appendShowcaseItem([{ kind: "review", id: "a" }], {
				kind: "review",
				id: "a",
			}),
		).toEqual({ error: "Already in your showcase" });
	});
});

describe("isShowcaseItemPresent", () => {
	test("detects existing review slot", () => {
		expect(
			isShowcaseItemPresent([{ kind: "review", id: "rev-1" }], {
				kind: "review",
				id: "rev-1",
			}),
		).toBe(true);
		expect(
			isShowcaseItemPresent([{ kind: "review", id: "rev-1" }], {
				kind: "review",
				id: "rev-2",
			}),
		).toBe(false);
	});
});
