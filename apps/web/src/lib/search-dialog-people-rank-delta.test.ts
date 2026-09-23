import { describe, expect, test } from "bun:test";

import {
	applySearchDialogPeopleRankMovements,
	searchDialogPeopleRankMovement,
	snapshotFromSearchDialogPeopleRanks,
} from "./search-dialog-people-rank-delta";

describe("searchDialogPeopleRankMovement", () => {
	test("climbed when previous rank was worse (higher number)", () => {
		expect(searchDialogPeopleRankMovement("a", 2, { a: 5 })).toBe("up");
	});

	test("dropped when previous rank was better (lower number)", () => {
		expect(searchDialogPeopleRankMovement("a", 4, { a: 1 })).toBe("down");
	});

	test("same when place is unchanged", () => {
		expect(searchDialogPeopleRankMovement("a", 3, { a: 3 })).toBe("same");
	});

	test("new when the person was not in the prior snapshot", () => {
		expect(searchDialogPeopleRankMovement("z", 1, { a: 1 })).toBe("new");
	});
});

describe("applySearchDialogPeopleRankMovements", () => {
	test("attaches movement and builds the next snapshot from current order", () => {
		const { items, nextSnapshot } = applySearchDialogPeopleRankMovements(
			[
				{ id: "10", rankLabel: "1" },
				{ id: "20", rankLabel: "2" },
			],
			{ "10": 2, "20": 1 },
		);
		expect(items.map((item) => item.rankMovement)).toEqual(["up", "down"]);
		expect(nextSnapshot).toEqual({ "10": 1, "20": 2 });
	});
});

describe("snapshotFromSearchDialogPeopleRanks", () => {
	test("maps id → 1-based rank from rail order", () => {
		expect(
			snapshotFromSearchDialogPeopleRanks([
				{ id: "a", rankLabel: "1" },
				{ id: "b", rankLabel: "2" },
			]),
		).toEqual({ a: 1, b: 2 });
	});
});
