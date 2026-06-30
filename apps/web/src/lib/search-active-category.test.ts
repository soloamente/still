import { describe, expect, test } from "bun:test";

import {
	enabledCategories,
	resolveActiveCategory,
	type SearchCategory,
} from "./search-active-category";

const zero: Record<SearchCategory, number> = {
	films: 0,
	tv: 0,
	castcrew: 0,
	lists: 0,
	members: 0,
};
const signedInPriority = enabledCategories(true);

describe("enabledCategories", () => {
	test("signed in returns all five in priority order", () => {
		expect(enabledCategories(true)).toEqual([
			"films",
			"tv",
			"castcrew",
			"lists",
			"members",
		]);
	});
	test("signed out drops lists and members", () => {
		expect(enabledCategories(false)).toEqual(["films", "tv", "castcrew"]);
	});
});

describe("resolveActiveCategory", () => {
	test("keeps current when it has results", () => {
		expect(
			resolveActiveCategory({
				current: "films",
				manualCategory: null,
				counts: { ...zero, films: 3, tv: 5 },
				priority: signedInPriority,
				anyLoading: false,
			}),
		).toBe("films");
	});

	test("switches to first priority category with results when current is empty", () => {
		expect(
			resolveActiveCategory({
				current: "films",
				manualCategory: null,
				counts: { ...zero, tv: 0, castcrew: 2 },
				priority: signedInPriority,
				anyLoading: false,
			}),
		).toBe("castcrew");
	});

	test("respects priority order (tv before castcrew)", () => {
		expect(
			resolveActiveCategory({
				current: "films",
				manualCategory: null,
				counts: { ...zero, tv: 1, castcrew: 9 },
				priority: signedInPriority,
				anyLoading: false,
			}),
		).toBe("tv");
	});

	test("respects manual choice even when empty and others have results", () => {
		expect(
			resolveActiveCategory({
				current: "films",
				manualCategory: "films",
				counts: { ...zero, tv: 4 },
				priority: signedInPriority,
				anyLoading: false,
			}),
		).toBe("films");
	});

	test("does not switch while loading", () => {
		expect(
			resolveActiveCategory({
				current: "films",
				manualCategory: null,
				counts: { ...zero, tv: 4 },
				priority: signedInPriority,
				anyLoading: true,
			}),
		).toBe("films");
	});

	test("stays on current when nothing has results", () => {
		expect(
			resolveActiveCategory({
				current: "tv",
				manualCategory: null,
				counts: zero,
				priority: signedInPriority,
				anyLoading: false,
			}),
		).toBe("tv");
	});

	test("ignores a manual category that is not enabled", () => {
		expect(
			resolveActiveCategory({
				current: "films",
				manualCategory: "members",
				counts: { ...zero, tv: 2 },
				priority: enabledCategories(false),
				anyLoading: false,
			}),
		).toBe("tv");
	});
});
