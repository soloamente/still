import { describe, expect, test } from "bun:test";

import { tasteMatchedRailTitle } from "./taste-matched-discovery";

describe("tasteMatchedRailTitle", () => {
	test("uses genre phrase when present", () => {
		expect(tasteMatchedRailTitle("drama and thriller")).toBe(
			"Because you gravitate toward drama and thriller",
		);
	});

	test("falls back when phrase missing", () => {
		expect(tasteMatchedRailTitle(null)).toBe("Because of your taste");
	});
});
