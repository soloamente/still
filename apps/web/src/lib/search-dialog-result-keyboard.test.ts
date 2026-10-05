import { describe, expect, test } from "bun:test";

import {
	moveSearchDialogResultIndex,
	searchDialogPosterGridColumnCount,
} from "@/lib/search-dialog-result-keyboard";

describe("searchDialogPosterGridColumnCount", () => {
	test("matches grid breakpoints", () => {
		expect(searchDialogPosterGridColumnCount(400)).toBe(3);
		expect(searchDialogPosterGridColumnCount(640)).toBe(4);
		expect(searchDialogPosterGridColumnCount(704)).toBe(5);
	});
});

describe("moveSearchDialogResultIndex", () => {
	test("list layout moves one row at a time", () => {
		expect(moveSearchDialogResultIndex(1, 5, "down", 3, "list")).toBe(2);
		expect(moveSearchDialogResultIndex(1, 5, "up", 3, "list")).toBe(0);
	});

	test("grid layout respects columns", () => {
		expect(moveSearchDialogResultIndex(0, 10, "down", 3, "grid")).toBe(3);
		expect(moveSearchDialogResultIndex(3, 10, "up", 3, "grid")).toBe(0);
		expect(moveSearchDialogResultIndex(0, 10, "right", 3, "grid")).toBe(1);
	});

	test("rail layout moves horizontally", () => {
		expect(moveSearchDialogResultIndex(2, 5, "left", 3, "rail")).toBe(1);
		expect(moveSearchDialogResultIndex(2, 5, "right", 3, "rail")).toBe(3);
	});
});
