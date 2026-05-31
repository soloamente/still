import { describe, expect, test } from "bun:test";

import { planCatalogueTagSearch } from "./catalogue-tag-search-plan";

describe("planCatalogueTagSearch", () => {
	test("anime filters + query uses tv discover with genre, keywords, and q", () => {
		const plan = planCatalogueTagSearch({
			q: "naruto",
			listingKind: "tv",
			studioId: null,
			genreIds: [16],
			keywordIds: [210024],
		});
		expect(plan.mode).toBe("discover");
		if (plan.mode !== "discover") return;
		expect(plan.listingKind).toBe("tv");
		expect(plan.opts.genreIds).toEqual([16]);
		expect(plan.opts.keywordIds).toEqual([210024]);
		expect(plan.opts.q).toBe("naruto");
	});

	test("anime filters + query + listingKind movie uses movie discover", () => {
		const plan = planCatalogueTagSearch({
			q: "spirited",
			listingKind: "movie",
			studioId: null,
			genreIds: [16],
			keywordIds: [210024],
		});
		expect(plan.mode).toBe("discover");
		if (plan.mode !== "discover") return;
		expect(plan.listingKind).toBe("movie");
		expect(plan.opts.q).toBe("spirited");
	});

	test("anime filters without query uses discover without q", () => {
		const plan = planCatalogueTagSearch({
			q: "",
			listingKind: "tv",
			studioId: null,
			genreIds: [16],
			keywordIds: [210024],
		});
		expect(plan.mode).toBe("discover");
		if (plan.mode !== "discover") return;
		expect(plan.opts.q).toBeUndefined();
	});

	test("studio-only with query uses discover with company and q", () => {
		const plan = planCatalogueTagSearch({
			q: "marty",
			listingKind: "movie",
			studioId: 41077,
			genreIds: [],
			keywordIds: [],
		});
		expect(plan.mode).toBe("discover");
		if (plan.mode !== "discover") return;
		expect(plan.opts.companyId).toBe(41077);
		expect(plan.opts.q).toBe("marty");
	});

	test("no filters and no query returns none", () => {
		const plan = planCatalogueTagSearch({
			q: "",
			listingKind: "movie",
			studioId: null,
			genreIds: [],
			keywordIds: [],
		});
		expect(plan.mode).toBe("none");
	});
});
