import { describe, expect, test } from "bun:test";

import { titleToMovieQuotesSlug } from "./moviequotes-slug";

describe("titleToMovieQuotesSlug", () => {
	test("kebab-cases common titles", () => {
		expect(titleToMovieQuotesSlug("The Matrix")).toBe("the-matrix");
		expect(titleToMovieQuotesSlug("Fight Club")).toBe("fight-club");
	});

	test("strips punctuation", () => {
		expect(titleToMovieQuotesSlug("Spider-Man: No Way Home")).toBe(
			"spider-man-no-way-home",
		);
	});
});
