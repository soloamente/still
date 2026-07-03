import { describe, expect, test } from "bun:test";

import { mergeActivitySignatureWeeks } from "./activity-signature-merge-weeks";

describe("mergeActivitySignatureWeeks", () => {
	test("prepends older weeks and dedupes by weekStart", () => {
		const existing = [{ weekStart: "2026-05-25", days: [] }];
		const older = [
			{ weekStart: "2026-05-18", days: [] },
			{ weekStart: "2026-05-25", days: [] },
		];
		const merged = mergeActivitySignatureWeeks(older, existing);
		expect(merged.map((week) => week.weekStart)).toEqual([
			"2026-05-18",
			"2026-05-25",
		]);
	});
});
