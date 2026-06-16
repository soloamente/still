import { describe, expect, test } from "bun:test";

import { presenceDotSurfaceClass } from "./patron-online-dot";

describe("presenceDotSurfaceClass", () => {
	test("active uses emerald", () => {
		expect(presenceDotSurfaceClass("active")).toContain("emerald");
	});

	test("away uses desert-orange", () => {
		expect(presenceDotSurfaceClass("away")).toContain("desert-orange");
	});
});
