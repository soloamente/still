import { describe, expect, test } from "bun:test";

import { annotateViewerFollows } from "./follow-list";

describe("annotateViewerFollows", () => {
	const rows = [
		{ userId: "mara", name: "Mara" },
		{ userId: "devon", name: "Devon" },
		{ userId: "jules", name: "Jules" },
	];

	test("flags rows the viewer already follows", () => {
		const result = annotateViewerFollows(rows, new Set(["mara", "jules"]));
		expect(result.map((r) => r.viewerFollows)).toEqual([true, false, true]);
	});

	test("preserves the original row fields", () => {
		const [first] = annotateViewerFollows(rows, new Set(["mara"]));
		expect(first).toEqual({
			userId: "mara",
			name: "Mara",
			viewerFollows: true,
		});
	});

	test("an empty following set marks everyone not-followed (signed-out case)", () => {
		const result = annotateViewerFollows(rows, new Set());
		expect(result.every((r) => r.viewerFollows === false)).toBe(true);
	});
});
