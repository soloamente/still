import { describe, expect, test } from "bun:test";

import { computeToastStackTops } from "./toast-stack";

describe("toast stack", () => {
	test("countdown alone sits on the top edge", () => {
		expect(
			computeToastStackTops({
				visible: { playback: false, countdown: true },
				heights: { playback: 0, countdown: 40 },
			}),
		).toEqual({ countdown: 20 });
	});

	test("countdown moves down when playback is showing", () => {
		expect(
			computeToastStackTops({
				visible: { playback: true, countdown: true },
				heights: { playback: 44, countdown: 40 },
			}),
		).toEqual({ playback: 20, countdown: 72 });
	});

	test("playback returns to the top edge when countdown hides", () => {
		expect(
			computeToastStackTops({
				visible: { playback: true, countdown: false },
				heights: { playback: 44, countdown: 0 },
			}),
		).toEqual({ playback: 20 });
	});
});
