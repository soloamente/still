import { describe, expect, test } from "bun:test";

import { computeScrollLeftAfterPrepend } from "./activity-signature-prepend-scroll";

describe("computeScrollLeftAfterPrepend", () => {
	test("adds width delta to scrollLeft", () => {
		expect(
			computeScrollLeftAfterPrepend({
				scrollLeft: 120,
				prevScrollWidth: 800,
				nextScrollWidth: 1000,
			}),
		).toBe(320);
	});

	test("returns unchanged scrollLeft when width is unchanged", () => {
		expect(
			computeScrollLeftAfterPrepend({
				scrollLeft: 48,
				prevScrollWidth: 600,
				nextScrollWidth: 600,
			}),
		).toBe(48);
	});
});
