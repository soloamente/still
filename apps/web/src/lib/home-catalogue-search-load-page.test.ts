import { describe, expect, test } from "bun:test";

import { planCatalogueTagSearch } from "@/lib/catalogue-tag-search-plan";
import {
	buildCatalogueSearchPlanFromCommit,
	committedCatalogueSearchNeedsTagMetadata,
	mapCatalogueSearchRowsToSeeds,
	parseCatalogueSearchPagePayload,
	resolveCatalogueSearchFetchTarget,
} from "@/lib/home-catalogue-search-load-page";

describe("resolveCatalogueSearchFetchTarget", () => {
	test("routes tag + text to discover", () => {
		const plan = planCatalogueTagSearch({
			q: "neon",
			listingKind: "movie",
			studioId: 41077,
			genreIds: [],
			keywordIds: [],
		});
		expect(resolveCatalogueSearchFetchTarget(plan)).toEqual({
			kind: "discover",
			listingKind: "movie",
		});
	});

	test("routes plain text to search", () => {
		const plan = planCatalogueTagSearch({
			q: "interstellar",
			listingKind: "movie",
			studioId: null,
			genreIds: [],
			keywordIds: [],
		});
		expect(resolveCatalogueSearchFetchTarget(plan)).toEqual({
			kind: "search",
			listingKind: "movie",
		});
	});

	test("returns none for empty plan", () => {
		const plan = planCatalogueTagSearch({
			q: "",
			listingKind: "tv",
			studioId: null,
			genreIds: [],
			keywordIds: [],
		});
		expect(resolveCatalogueSearchFetchTarget(plan)).toEqual({ kind: "none" });
	});
});

describe("mapCatalogueSearchRowsToSeeds", () => {
	test("maps rows with listing kind for mixed grids", () => {
		expect(
			mapCatalogueSearchRowsToSeeds(
				[{ id: 42, title: "Blade Runner 2049", poster_url: "/p.jpg" }],
				"movie",
			),
		).toEqual([
			{
				id: 42,
				title: "Blade Runner 2049",
				poster_url: "/p.jpg",
				listingKind: "movie",
			},
		]);
	});
});

describe("parseCatalogueSearchPagePayload", () => {
	test("parses results and total_pages", () => {
		const parsed = parseCatalogueSearchPagePayload(
			{
				results: [{ id: 1, title: "Dune", poster_url: null }],
				total_pages: 5,
			},
			"movie",
		);
		expect(parsed).toEqual({
			results: [
				{
					id: 1,
					title: "Dune",
					poster_url: null,
					listingKind: "movie",
				},
			],
			total_pages: 5,
		});
	});

	test("defaults total_pages to 1 when rows exist but total_pages missing", () => {
		const parsed = parseCatalogueSearchPagePayload(
			{ results: [{ id: 2, title: "Arrival", poster_url: null }] },
			"tv",
		);
		expect(parsed?.total_pages).toBe(1);
		expect(parsed?.results[0]?.listingKind).toBe("tv");
	});

	test("returns empty page when payload has no rows", () => {
		expect(parseCatalogueSearchPagePayload({ results: [] }, "movie")).toEqual({
			results: [],
			total_pages: 0,
		});
	});
});

describe("committedCatalogueSearchNeedsTagMetadata", () => {
	test("plain text needs metadata to disambiguate tag-only URLs", () => {
		expect(committedCatalogueSearchNeedsTagMetadata("interstellar")).toBe(true);
	});

	test("structured query needs metadata", () => {
		expect(committedCatalogueSearchNeedsTagMetadata("A24 · Horror")).toBe(true);
	});

	test("empty query does not need metadata", () => {
		expect(committedCatalogueSearchNeedsTagMetadata("   ")).toBe(false);
	});
});

describe("buildCatalogueSearchPlanFromCommit", () => {
	test("maps browse + tags to discover plan", () => {
		const plan = buildCatalogueSearchPlanFromCommit(
			[{ kind: "studio", id: 41077, label: "A24" }],
			"neon",
			"movies",
		);
		expect(plan.mode).toBe("discover");
		expect(plan.listingKind).toBe("movie");
		expect(resolveCatalogueSearchFetchTarget(plan)).toEqual({
			kind: "discover",
			listingKind: "movie",
		});
	});

	test("uses tv listing kind on tv browse", () => {
		const plan = buildCatalogueSearchPlanFromCommit([], "severance", "tv");
		expect(plan.mode).toBe("discover");
		expect(plan.listingKind).toBe("tv");
		if (plan.mode === "discover") {
			expect(plan.opts.q).toBe("severance");
			expect(plan.opts.sortBy).toBe("popularity.desc");
		}
	});

	test("plain text latest uses discover text query with release sort", () => {
		const plan = buildCatalogueSearchPlanFromCommit(
			[],
			"noir",
			"movies",
			"latest",
		);
		expect(plan.mode).toBe("discover");
		if (plan.mode === "discover") {
			expect(plan.opts.q).toBe("noir");
			expect(plan.opts.sortBy).toBe("primary_release_date.desc");
		}
	});

	test("single studio tag uses discover not text search", () => {
		const plan = buildCatalogueSearchPlanFromCommit(
			[{ kind: "studio", id: 41077, name: "A24", logoUrl: null }],
			"",
			"movies",
		);
		expect(plan.mode).toBe("discover");
		if (plan.mode === "discover") {
			expect(plan.opts.companyId).toBe(41077);
			expect(plan.opts.q).toBeUndefined();
		}
	});
});
