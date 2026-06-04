import { describe, expect, test } from "bun:test";
import {
	buildHomeCatalogueSearchClearHref,
	buildHomeCatalogueSearchCommitHref,
	buildHomeCatalogueSearchSortHref,
	canCommitCatalogueSearch,
	formatCommittedSearchSummary,
	HOME_CATALOGUE_SEARCH_PARAM,
	parseHomeCatalogueSearchLobbySort,
	parseHomeCatalogueSearchParam,
	resolveCommitBrowseFromDraft,
	serializeHomeCatalogueSearchParam,
} from "@/lib/home-catalogue-search-param";
import { emptyHomeLobbyPersisted } from "@/lib/home-lobby-persist";
import type { SearchTag } from "@/lib/search-query-tags";

const studios = [{ id: 41077, name: "A24", logoUrl: null }] as const;

const movieGenres = [{ id: 27, name: "Horror" }];
const tvGenres = [{ id: 16, name: "Animation" }];

const studioTag: SearchTag = {
	kind: "studio",
	id: 41077,
	name: "A24",
	logoUrl: null,
};

const genreTag: SearchTag = {
	kind: "genre",
	id: 27,
	name: "Horror",
	listingKind: "movie",
};

describe("canCommitCatalogueSearch", () => {
	test("returns false for empty draft", () => {
		expect(canCommitCatalogueSearch([], "")).toBe(false);
		expect(canCommitCatalogueSearch([], "   ")).toBe(false);
	});

	test("returns false when lists tag is present", () => {
		expect(canCommitCatalogueSearch([{ kind: "lists" }], "neon")).toBe(false);
	});

	test("returns true for plain text", () => {
		expect(canCommitCatalogueSearch([], "interstellar")).toBe(true);
	});

	test("returns false for people-only @handle draft", () => {
		expect(canCommitCatalogueSearch([], "@ada")).toBe(false);
		expect(canCommitCatalogueSearch([], "@")).toBe(false);
	});

	test("returns true for catalogue tags", () => {
		expect(canCommitCatalogueSearch([studioTag], "")).toBe(true);
		expect(canCommitCatalogueSearch([genreTag], "")).toBe(true);
		expect(
			canCommitCatalogueSearch([{ kind: "media", listingKind: "tv" }], ""),
		).toBe(true);
		expect(
			canCommitCatalogueSearch(
				[{ kind: "curated", slug: "anime", label: "Anime" }],
				"",
			),
		).toBe(true);
	});
});

describe("serializeHomeCatalogueSearchParam / parseHomeCatalogueSearchParam", () => {
	test("round-trips tags and free text", () => {
		const tags = [studioTag, genreTag];
		const freeText = "neon";
		const serialized = serializeHomeCatalogueSearchParam(tags, freeText);
		const parsed = parseHomeCatalogueSearchParam(serialized, [...studios], {
			movieGenres,
			tvGenres,
		});
		expect(parsed.freeText).toBe(freeText);
		expect(parsed.tags).toHaveLength(2);
		expect(parsed.tags[0]?.kind).toBe("studio");
		expect(parsed.tags[1]?.kind).toBe("genre");
	});

	test("plain text without separator round-trips as free text only", () => {
		const parsed = parseHomeCatalogueSearchParam("interstellar", [...studios], {
			movieGenres,
			tvGenres,
		});
		expect(parsed.tags).toEqual([]);
		expect(parsed.freeText).toBe("interstellar");
	});

	test("single studio tag round-trips without middle dot", () => {
		const serialized = serializeHomeCatalogueSearchParam([studioTag], "");
		expect(serialized).toBe("A24");
		const parsed = parseHomeCatalogueSearchParam(serialized, [...studios], {
			movieGenres,
			tvGenres,
		});
		expect(parsed.tags).toEqual([studioTag]);
		expect(parsed.freeText).toBe("");
	});
});

describe("formatCommittedSearchSummary", () => {
	test("returns full string when short", () => {
		expect(formatCommittedSearchSummary([studioTag], "neon")).toBe(
			"A24 · neon",
		);
	});

	test("truncates long summaries", () => {
		const long = "a".repeat(50);
		const summary = formatCommittedSearchSummary([], long, 40);
		expect(summary.length).toBe(40);
		expect(summary.endsWith("…")).toBe(true);
	});
});

describe("resolveCommitBrowseFromDraft", () => {
	test("prefers media tag listing kind", () => {
		expect(
			resolveCommitBrowseFromDraft(
				[{ kind: "media", listingKind: "tv" }],
				"movie",
			),
		).toBe("tv");
		expect(
			resolveCommitBrowseFromDraft(
				[{ kind: "media", listingKind: "movie" }],
				"tv",
			),
		).toBe("movies");
	});

	test("falls back to dialog listing kind toggle", () => {
		expect(resolveCommitBrowseFromDraft([], "tv")).toBe("tv");
		expect(resolveCommitBrowseFromDraft([], "movie")).toBe("movies");
	});
});

describe("buildHomeCatalogueSearchCommitHref", () => {
	test("sets search and strips browse chip params", () => {
		const href = buildHomeCatalogueSearchCommitHref({
			browse: "movies",
			tags: [studioTag, genreTag],
			freeText: "neon",
			currentParams: new URLSearchParams(
				"sort=popular&venue=theaters&run=ongoing&animeSeason=1",
			),
		});
		const url = new URL(href, "https://sense.test");
		expect(url.pathname).toBe("/home");
		expect(url.searchParams.get("sort")).toBe("popular");
		expect(url.searchParams.has("venue")).toBe(false);
		expect(url.searchParams.has("run")).toBe(false);
		expect(url.searchParams.has("animeSeason")).toBe(false);
		expect(url.searchParams.get(HOME_CATALOGUE_SEARCH_PARAM)).toContain("A24");
		expect(url.searchParams.get(HOME_CATALOGUE_SEARCH_PARAM)).toContain("neon");
	});

	test("sets browse=tv when committing tv surface", () => {
		const href = buildHomeCatalogueSearchCommitHref({
			browse: "tv",
			tags: [{ kind: "curated", slug: "anime", label: "Anime" }],
			freeText: "",
		});
		expect(href).toContain("browse=tv");
	});
});

describe("buildHomeCatalogueSearchClearHref", () => {
	test("drops search and restores persisted movies slot", () => {
		const href = buildHomeCatalogueSearchClearHref("movies", {
			...emptyHomeLobbyPersisted(),
			movies: { sort: "popular", venue: "theaters" },
		});
		expect(href).toBe("/home?sort=popular&venue=theaters");
		expect(href).not.toContain(HOME_CATALOGUE_SEARCH_PARAM);
	});
});

describe("buildHomeCatalogueSearchSortHref", () => {
	test("keeps search and updates sort", () => {
		const href = buildHomeCatalogueSearchSortHref({
			browse: "movies",
			sort: "latest",
			currentParams: new URLSearchParams("search=noir&sort=popular"),
		});
		expect(href).toBe("/home?search=noir&sort=latest");
	});
});

describe("parseHomeCatalogueSearchLobbySort", () => {
	test("defaults to popular when sort missing", () => {
		expect(
			parseHomeCatalogueSearchLobbySort(
				new URLSearchParams("search=test"),
				"movies",
			),
		).toBe("popular");
	});

	test("maps popular explicitly", () => {
		expect(
			parseHomeCatalogueSearchLobbySort(
				new URLSearchParams("search=test&sort=popular"),
				"tv",
			),
		).toBe("popular");
	});
});
