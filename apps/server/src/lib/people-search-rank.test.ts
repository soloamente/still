import { describe, expect, test } from "bun:test";

import {
	mergeTrafficLedPeople,
	rankPeopleBySearchTraffic,
	rankPeopleFavoritesFirst,
} from "./people-search-rank";

describe("rankPeopleBySearchTraffic", () => {
	test("orders by on-site search hits before TMDb popularity", () => {
		const rows = [
			{ id: 1, popularity: 99 },
			{ id: 2, popularity: 10 },
			{ id: 3, popularity: 50 },
		];
		const traffic = new Map([
			[2, 40],
			[3, 12],
		]);
		expect(
			rankPeopleBySearchTraffic(rows, traffic).map((row) => row.id),
		).toEqual([2, 3, 1]);
	});

	test("breaks traffic ties with TMDb popularity", () => {
		const rows = [
			{ id: 1, popularity: 2 },
			{ id: 2, popularity: 9 },
		];
		const traffic = new Map([
			[1, 3],
			[2, 3],
		]);
		expect(
			rankPeopleBySearchTraffic(rows, traffic).map((row) => row.id),
		).toEqual([2, 1]);
	});

	test("treats missing traffic as zero", () => {
		const rows = [
			{ id: 8, popularity: 1 },
			{ id: 9, popularity: 1 },
		];
		expect(
			rankPeopleBySearchTraffic(rows, new Map([[9, 1]])).map((row) => row.id),
		).toEqual([9, 8]);
	});
});

describe("rankPeopleFavoritesFirst", () => {
	test("puts favorited people above traffic-ranked others", () => {
		const rows = [
			{ id: 1, popularity: 99 },
			{ id: 2, popularity: 10 },
			{ id: 3, popularity: 50 },
		];
		const traffic = new Map([
			[2, 40],
			[3, 12],
		]);
		const ranked = rankPeopleFavoritesFirst(
			rows,
			new Set([1, 3]),
			(slice) => rankPeopleBySearchTraffic(slice, traffic),
		);
		// Favorites band ordered by traffic among themselves (3 before 1), then 2.
		expect(ranked.map((row) => row.id)).toEqual([3, 1, 2]);
	});

	test("preserves thenRank order when no favorites", () => {
		const rows = [
			{ id: 1, popularity: 99 },
			{ id: 2, popularity: 10 },
		];
		const traffic = new Map([[2, 40]]);
		expect(
			rankPeopleFavoritesFirst(rows, new Set(), (slice) =>
				rankPeopleBySearchTraffic(slice, traffic),
			).map((row) => row.id),
		).toEqual([2, 1]);
	});
});

describe("mergeTrafficLedPeople", () => {
	test("leads with Sense traffic then fills unique TMDb rows", () => {
		const merged = mergeTrafficLedPeople(
			[{ id: 2, name: "Ada" }],
			[
				{ id: 2, name: "Ada TMDb" },
				{ id: 1, name: "Ben" },
				{ id: 3, name: "Cara" },
			],
			2,
		);
		expect(merged).toEqual([
			{ id: 2, name: "Ada" },
			{ id: 1, name: "Ben" },
		]);
	});
});
