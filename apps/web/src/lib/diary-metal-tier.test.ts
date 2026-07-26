import { describe, expect, test } from "bun:test";

import { isCircularPatronPortraitClass } from "./diary-metal-tier";

describe("diary-metal-tier", () => {
	test("isCircularPatronPortraitClass rejects rounded poster frames", () => {
		expect(isCircularPatronPortraitClass("size-full rounded-full")).toBe(true);
		expect(isCircularPatronPortraitClass("size-full rounded-2xl")).toBe(false);
	});
});
