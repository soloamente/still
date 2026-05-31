import { describe, expect, test } from "bun:test";

import {
	countListItemAnnotations,
	listHasDiscoverabilityDescription,
} from "./list-quality";

describe("list-quality", () => {
	test("discoverability description threshold", () => {
		expect(listHasDiscoverabilityDescription(null)).toBe(false);
		expect(listHasDiscoverabilityDescription("short")).toBe(false);
		expect(
			listHasDiscoverabilityDescription(
				"A slow-burn canon for rainy weekends and long credits.",
			),
		).toBe(true);
	});

	test("counts annotated items", () => {
		expect(
			countListItemAnnotations([
				{ note: null },
				{ note: "  " },
				{ note: "Peak Villeneuve" },
			]),
		).toBe(1);
	});
});
