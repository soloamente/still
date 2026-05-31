import { describe, expect, test } from "bun:test";

import {
	buildOverlapDiaryMap,
	computeTasteOverlap,
	type OverlapDiarySlice,
	storedRatingToDisplayTen,
} from "./sense-taste-overlap";

function slice(
	overrides: Partial<OverlapDiarySlice> & Pick<OverlapDiarySlice, "key">,
): OverlapDiarySlice {
	return {
		mediaKind: "movie",
		movieId: 1,
		tvId: null,
		title: "Test",
		posterPath: null,
		rating: null,
		watchedAtMs: 0,
		...overrides,
	};
}

describe("sense-taste-overlap", () => {
	test("storedRatingToDisplayTen handles tenths and legacy", () => {
		expect(storedRatingToDisplayTen(85)).toBe(8.5);
		expect(storedRatingToDisplayTen(9)).toBe(9);
	});

	test("dedupes to latest watch per media key", () => {
		const map = buildOverlapDiaryMap([
			slice({ key: "m:1", rating: 80, watchedAtMs: 100 }),
			slice({ key: "m:1", rating: 90, watchedAtMs: 200 }),
		]);
		expect(map.get("m:1")?.rating).toBe(90);
	});

	test("returns zero shared when diaries do not intersect", () => {
		const viewer = buildOverlapDiaryMap([slice({ key: "m:1" })]);
		const target = buildOverlapDiaryMap([slice({ key: "m:2" })]);
		const result = computeTasteOverlap(viewer, target);
		expect(result.sharedWatches).toBe(0);
		expect(result.compatibilityPercent).toBe(0);
		expect(result.framingHeadline).toContain("No shared");
	});

	test("high compatibility when ratings agree on shared titles", () => {
		const viewer = buildOverlapDiaryMap([
			slice({ key: "m:1", rating: 90, watchedAtMs: 1 }),
			slice({ key: "m:2", rating: 80, watchedAtMs: 2 }),
			slice({ key: "m:3", rating: 85, watchedAtMs: 3 }),
		]);
		const target = buildOverlapDiaryMap([
			slice({ key: "m:1", rating: 88, watchedAtMs: 1 }),
			slice({ key: "m:2", rating: 82, watchedAtMs: 2 }),
			slice({ key: "m:3", rating: 84, watchedAtMs: 3 }),
		]);
		const result = computeTasteOverlap(viewer, target);
		expect(result.sharedWatches).toBe(3);
		expect(result.ratedOverlap).toBe(3);
		expect(result.compatibilityPercent).toBeGreaterThanOrEqual(75);
		expect(result.divergences.length).toBeGreaterThan(0);
	});

	test("symmetric compatibility when viewer and target swap", () => {
		const a = buildOverlapDiaryMap([
			slice({ key: "m:10", rating: 100, watchedAtMs: 1 }),
			slice({ key: "m:11", rating: 50, watchedAtMs: 2 }),
		]);
		const b = buildOverlapDiaryMap([
			slice({ key: "m:10", rating: 40, watchedAtMs: 1 }),
			slice({ key: "m:12", rating: 70, watchedAtMs: 3 }),
		]);
		const ab = computeTasteOverlap(a, b).compatibilityPercent;
		const ba = computeTasteOverlap(b, a).compatibilityPercent;
		expect(ab).toBe(ba);
	});
});
