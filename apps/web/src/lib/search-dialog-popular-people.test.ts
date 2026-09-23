import { describe, expect, test } from "bun:test";

import {
	pickSearchDialogPopularPeople,
	searchDialogPopularPeopleToRailItems,
} from "./search-dialog-popular-people";

describe("pickSearchDialogPopularPeople", () => {
	test("keeps the API's traffic-ranked order", () => {
		const rows = [
			{ id: 1, name: "No Photo", profileUrl: null },
			{ id: 2, name: "Ada", profileUrl: "https://img/a.jpg" },
			{ id: 3, name: "Ben", profileUrl: "https://img/b.jpg" },
			{ id: 4, name: "Cara", profileUrl: null },
		];
		expect(pickSearchDialogPopularPeople(rows, 3)).toEqual([
			{ id: 1, name: "No Photo", profileUrl: null },
			{ id: 2, name: "Ada", profileUrl: "https://img/a.jpg" },
			{ id: 3, name: "Ben", profileUrl: "https://img/b.jpg" },
		]);
	});

	test("caps at the rail limit", () => {
		const rows = Array.from({ length: 20 }, (_, i) => ({
			id: i + 1,
			name: `P${i + 1}`,
			profileUrl: `https://img/${i + 1}.jpg`,
		}));
		expect(pickSearchDialogPopularPeople(rows, 12)).toHaveLength(12);
		expect(pickSearchDialogPopularPeople(rows, 12)[0]?.id).toBe(1);
		expect(pickSearchDialogPopularPeople(rows, 12)[11]?.id).toBe(12);
	});

	test("maps 1-based rank labels onto rail tiles", () => {
		expect(
			searchDialogPopularPeopleToRailItems([
				{ id: 87, name: "Zendaya", profileUrl: "https://img/z.jpg" },
			]),
		).toEqual([
			{
				id: "87",
				name: "Zendaya",
				imageUrl: "https://img/z.jpg",
				rankLabel: "1",
			},
		]);
	});
});
