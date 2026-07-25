import { describe, expect, test } from "bun:test";

import {
	DEFAULT_HOME_CATALOG_SORT,
	parseHomeCatalogSort,
} from "./home-catalog-sort";

describe("parseHomeCatalogSort", () => {
	test("bare / missing sort defaults to Popular", () => {
		expect(parseHomeCatalogSort(undefined)).toBe("popular");
		expect(parseHomeCatalogSort(null)).toBe("popular");
		expect(parseHomeCatalogSort("")).toBe(DEFAULT_HOME_CATALOG_SORT);
	});

	test("legacy ongoing sort on TV maps to popular (lifecycle uses ?run=)", () => {
		expect(parseHomeCatalogSort("ongoing", "tv")).toBe("popular");
		// Unknown token on movies falls through to the Popular default.
		expect(parseHomeCatalogSort("ongoing", "movies")).toBe("popular");
	});

	test("legacy on_the_air alias on TV maps to popular", () => {
		expect(parseHomeCatalogSort("on_the_air", "tv")).toBe("popular");
	});

	test("legacy upcoming sort on TV maps to popular (slice uses ?run=upcoming)", () => {
		expect(parseHomeCatalogSort("upcoming", "tv")).toBe("popular");
	});

	test("explicit latest still resolves", () => {
		expect(parseHomeCatalogSort("latest")).toBe("latest");
	});
});
