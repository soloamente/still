import { describe, expect, test } from "bun:test";

import { parseHomeCatalogSort } from "./home-catalog-sort";

describe("parseHomeCatalogSort", () => {
	test("legacy ongoing sort on TV maps to popular (lifecycle uses ?run=)", () => {
		expect(parseHomeCatalogSort("ongoing", "tv")).toBe("popular");
		expect(parseHomeCatalogSort("ongoing", "movies")).toBe("latest");
	});

	test("legacy on_the_air alias on TV maps to popular", () => {
		expect(parseHomeCatalogSort("on_the_air", "tv")).toBe("popular");
	});

	test("legacy upcoming sort on TV maps to popular (slice uses ?run=upcoming)", () => {
		expect(parseHomeCatalogSort("upcoming", "tv")).toBe("popular");
	});
});
