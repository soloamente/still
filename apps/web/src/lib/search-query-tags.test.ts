import { describe, expect, test } from "bun:test";

import {
	deriveCatalogueFilterBundle,
	deriveSearchState,
	genreNameMatchesToken,
	parseRecentStructuredQuery,
	rankTagSuggestions,
	serializeStructuredQuery,
	suggestionToTag,
	upsertTag,
} from "./search-query-tags";

const studios = [
	{ id: 41077, name: "A24", logoUrl: null },
	{ id: 1, name: "Sony Pictures Classics", logoUrl: null },
	{ id: 2, name: "Searchlight Pictures", logoUrl: null },
] as const;
const movieGenres = [{ id: 27, name: "Horror" }];

describe("rankTagSuggestions", () => {
	test("matches a24 studio", () => {
		const suggestions = rankTagSuggestions(
			"a24",
			[...studios],
			movieGenres,
			"movie",
			[],
		);
		expect(suggestions[0]?.kind).toBe("studio");
	});

	test("matches studio aliases and substrings", () => {
		const spc = rankTagSuggestions(
			"spc",
			[...studios],
			movieGenres,
			"movie",
			[],
		);
		expect(
			spc.some((s) => s.kind === "studio" && s.name.includes("Sony")),
		).toBe(true);

		const searchlight = rankTagSuggestions(
			"search",
			[...studios],
			movieGenres,
			"movie",
			[],
		);
		expect(
			searchlight.some(
				(s) => s.kind === "studio" && s.name.includes("Searchlight"),
			),
		).toBe(true);
	});

	test("tv media tag still allows studio suggestions", () => {
		const suggestions = rankTagSuggestions(
			"a24",
			[...studios],
			movieGenres,
			"tv",
			[{ kind: "media", listingKind: "tv" }],
		);
		expect(suggestions.some((s) => s.kind === "studio")).toBe(true);
	});

	test("lists tag blocks further suggestions", () => {
		const suggestions = rankTagSuggestions(
			"a24",
			[{ id: 1, name: "A24", logoUrl: null }],
			movieGenres,
			"movie",
			[{ kind: "lists" }],
		);
		expect(suggestions.length).toBe(0);
	});

	test("prefix-matches genre and curated", () => {
		const suggestions = rankTagSuggestions("hor", [], movieGenres, "movie", []);
		expect(
			suggestions.some((s) => s.kind === "genre" && s.label === "Horror"),
		).toBe(true);

		const spanishGenres = [{ id: 27, name: "Terror" }];
		const terror = rankTagSuggestions("ter", [], spanishGenres, "movie", []);
		expect(terror.some((s) => s.kind === "genre" && s.label === "Terror")).toBe(
			true,
		);

		const anime = rankTagSuggestions("ani", [], [], "movie", []);
		expect(anime.some((s) => s.kind === "curated")).toBe(true);
	});
});

describe("genreNameMatchesToken", () => {
	test("matches English Horror prefix", () => {
		expect(genreNameMatchesToken("Horror", "hor")).toBe(true);
	});

	test("does not require localized label prefix", () => {
		expect(genreNameMatchesToken("Terror", "hor")).toBe(false);
	});
});

describe("upsertTag", () => {
	test("lists replaces catalogue tags", () => {
		const next = upsertTag(
			[
				{ kind: "studio", id: 1, name: "A24", logoUrl: null },
				{ kind: "media", listingKind: "movie" },
			],
			{ kind: "lists" },
		);
		expect(next).toEqual([{ kind: "lists" }]);
	});

	test("dedupes same genre id", () => {
		const a = {
			kind: "genre" as const,
			id: 27,
			name: "Horror",
			listingKind: "movie" as const,
		};
		const next = upsertTag([a], { ...a });
		expect(next).toHaveLength(1);
	});
});

describe("deriveCatalogueFilterBundle", () => {
	test("merges genre and curated AND for active listing kind", () => {
		const bundle = deriveCatalogueFilterBundle([
			{ kind: "curated", slug: "anime", label: "Anime" },
			{ kind: "genre", id: 27, name: "Horror", listingKind: "movie" },
			{ kind: "media", listingKind: "tv" },
		]);
		expect(bundle.listingKind).toBe("tv");
		expect(bundle.genreIds).toContain(27);
		expect(bundle.genreIds).toContain(16);
		expect(bundle.keywordIds).toContain(210024);
	});

	test("listingKindOverride applies curated rules when no media tag", () => {
		const tvBundle = deriveCatalogueFilterBundle(
			[{ kind: "curated", slug: "anime", label: "Anime" }],
			"tv",
		);
		expect(tvBundle.listingKind).toBe("tv");
		expect(tvBundle.genreIds).toContain(16);
		expect(tvBundle.keywordIds).toContain(210024);

		const movieBundle = deriveCatalogueFilterBundle(
			[{ kind: "curated", slug: "anime", label: "Anime" }],
			"movie",
		);
		expect(movieBundle.listingKind).toBe("movie");
		expect(movieBundle.genreIds).toContain(16);
		expect(movieBundle.keywordIds).toContain(210024);
	});

	test("media tag wins over listingKindOverride", () => {
		const bundle = deriveCatalogueFilterBundle(
			[
				{ kind: "media", listingKind: "tv" },
				{ kind: "curated", slug: "anime", label: "Anime" },
			],
			"movie",
		);
		expect(bundle.listingKind).toBe("tv");
	});
});

describe("deriveSearchState", () => {
	test("media pill sets listing kind", () => {
		const state = deriveSearchState([{ kind: "media", listingKind: "tv" }]);
		expect(state.listingKind).toBe("tv");
		expect(state.resultMode).toBe("catalogue");
	});
});

describe("suggestionToTag", () => {
	test("maps media suggestion", () => {
		const tag = suggestionToTag({
			kind: "media",
			listingKind: "movie",
			label: "Films",
		});
		expect(tag).toEqual({ kind: "media", listingKind: "movie" });
	});
});

describe("structured recent queries", () => {
	test("serialize tags then free text", () => {
		const raw = serializeStructuredQuery(
			[
				{ kind: "studio", id: 41077, name: "A24", logoUrl: null },
				{ kind: "media", listingKind: "movie" },
			],
			"marty",
		);
		expect(raw).toBe("A24 · Films · marty");
	});

	test("serialize includes genre and curated pills", () => {
		const raw = serializeStructuredQuery(
			[
				{ kind: "studio", id: 1, name: "A24", logoUrl: null },
				{ kind: "genre", id: 27, name: "Horror", listingKind: "movie" },
				{ kind: "curated", slug: "anime", label: "Anime" },
			],
			"marty",
		);
		expect(raw).toBe("A24 · Horror · Anime · marty");
	});

	test("parse restores tags and free text", () => {
		const parsed = parseRecentStructuredQuery("A24 · Films · marty", [
			...studios,
		]);
		expect(parsed.tags).toEqual([
			{ kind: "studio", id: 41077, name: "A24", logoUrl: null },
			{ kind: "media", listingKind: "movie" },
		]);
		expect(parsed.freeText).toBe("marty");
	});

	test("parse restores genre and curated", () => {
		const parsed = parseRecentStructuredQuery("Horror · Anime · marty", [], {
			movieGenres,
		});
		expect(parsed.tags).toEqual([
			{ kind: "genre", id: 27, name: "Horror", listingKind: "movie" },
			{ kind: "curated", slug: "anime", label: "Anime" },
		]);
		expect(parsed.freeText).toBe("marty");
	});

	test("legacy plain string is free text only", () => {
		const parsed = parseRecentStructuredQuery("marty", [...studios]);
		expect(parsed.tags).toEqual([]);
		expect(parsed.freeText).toBe("marty");
	});
});
