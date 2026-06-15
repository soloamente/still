import { describe, expect, test } from "bun:test";

import type { MembersLeaderboardLedgerItem } from "./members-leaderboard-item-types";
import {
	patronMembersLedgerOrderLabels,
	sortPatronMembersLedgerItems,
} from "./patron-members-ledger-order";

function reviewItem(id: string, sortAt: string): MembersLeaderboardLedgerItem {
	return {
		itemKind: "review",
		itemKey: id,
		sortAt,
		reviewId: id,
		movieId: 1,
		listingTitle: `Title ${id}`,
		posterPath: null,
		reviewTitle: null,
		reviewBody: "body",
		rating: 80,
		likesCount: 0,
		commentsCount: 0,
		publishedAt: sortAt,
		containsSpoilers: false,
		userId: "u1",
	};
}

describe("sortPatronMembersLedgerItems", () => {
	test("latest orders by sortAt descending", () => {
		const items = [
			reviewItem("a", "2026-01-01T00:00:00.000Z"),
			reviewItem("b", "2026-06-01T00:00:00.000Z"),
		];
		const sorted = sortPatronMembersLedgerItems(items, "latest");
		expect(sorted.map((item) => item.itemKey)).toEqual(["b", "a"]);
	});

	test("earliest orders by sortAt ascending", () => {
		const items = [
			reviewItem("a", "2026-01-01T00:00:00.000Z"),
			reviewItem("b", "2026-06-01T00:00:00.000Z"),
		];
		const sorted = sortPatronMembersLedgerItems(items, "earliest");
		expect(sorted.map((item) => item.itemKey)).toEqual(["a", "b"]);
	});
});

describe("patronMembersLedgerOrderLabels", () => {
	test("reviews rank uses reviewed copy", () => {
		const labels = patronMembersLedgerOrderLabels("reviews");
		expect(labels.latest).toBe("Latest reviewed");
		expect(labels.earliest).toBe("Earliest reviewed");
	});
});
