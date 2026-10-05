import { describe, expect, test } from "bun:test";

import {
	moveSearchDialogEmptyBrowseFocus,
	searchDialogEmptyBrowseTotalCount,
} from "@/lib/search-dialog-empty-browse-keyboard";

describe("searchDialogEmptyBrowseTotalCount", () => {
	test("sums section counts", () => {
		expect(
			searchDialogEmptyBrowseTotalCount([
				{ kind: "rail", count: 3 },
				{ kind: "list", count: 2 },
			]),
		).toBe(5);
	});
});

describe("moveSearchDialogEmptyBrowseFocus", () => {
	const sections = [
		{ kind: "rail" as const, count: 2 },
		{ kind: "rail" as const, count: 2 },
		{ kind: "list" as const, count: 3 },
	];

	test("first down lands on index 0", () => {
		expect(moveSearchDialogEmptyBrowseFocus(null, sections, "down")).toBe(0);
	});

	test("right moves within a rail", () => {
		expect(moveSearchDialogEmptyBrowseFocus(0, sections, "right")).toBe(1);
	});

	test("down moves to next section", () => {
		expect(moveSearchDialogEmptyBrowseFocus(1, sections, "down")).toBe(2);
	});

	test("down on list moves row by row", () => {
		expect(moveSearchDialogEmptyBrowseFocus(4, sections, "down")).toBe(5);
	});

	test("up from rail returns to previous rail with clamped column", () => {
		expect(moveSearchDialogEmptyBrowseFocus(3, sections, "up")).toBe(1);
	});
});
