import { describe, expect, test } from "bun:test";

import {
	DEFAULT_HOME_CATALOG_RUN,
	effectiveHomeCatalogRun,
	parseHomeCatalogRun,
	tvDiscoverSortByForLobbySort,
} from "./home-catalog-run";

describe("parseHomeCatalogRun", () => {
	test("ongoing, completed, and upcoming apply on TV browse only", () => {
		expect(parseHomeCatalogRun("ongoing", "tv")).toBe("ongoing");
		expect(parseHomeCatalogRun("completed", "tv")).toBe("completed");
		expect(parseHomeCatalogRun("upcoming", "tv")).toBe("upcoming");
		expect(parseHomeCatalogRun("ongoing", "movies")).toBeNull();
	});

	test("aliases map to lifecycle runs on TV", () => {
		expect(parseHomeCatalogRun("on_the_air", "tv")).toBe("ongoing");
		expect(parseHomeCatalogRun("ended", "tv")).toBe("completed");
		expect(parseHomeCatalogRun("soon", "tv")).toBe("upcoming");
	});
});

describe("tvDiscoverSortByForLobbySort", () => {
	test("maps left-rail sort to TMDb discover sort_by", () => {
		expect(tvDiscoverSortByForLobbySort("popular")).toBe("popularity.desc");
		expect(tvDiscoverSortByForLobbySort("latest")).toBe("first_air_date.desc");
	});
});

describe("effectiveHomeCatalogRun", () => {
	test("defaults TV to ongoing when run is absent", () => {
		expect(
			effectiveHomeCatalogRun({ run: null, browse: "tv", animeSeason: false }),
		).toBe(DEFAULT_HOME_CATALOG_RUN);
	});

	test("preserves explicit run and defers to anime season", () => {
		expect(
			effectiveHomeCatalogRun({
				run: "completed",
				browse: "tv",
				animeSeason: false,
			}),
		).toBe("completed");
		expect(
			effectiveHomeCatalogRun({
				run: null,
				browse: "tv",
				animeSeason: true,
			}),
		).toBeNull();
	});
});
