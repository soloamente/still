import { describe, expect, test } from "bun:test";

import {
	movieStudioMarks,
	movieStudioNameFallback,
	studioSearchButtonLabel,
} from "./movie-studio-credit";

describe("movieStudioMarks", () => {
	test("keeps the first two companies that have a logo", () => {
		expect(
			movieStudioMarks([
				{ id: 1, name: "Pinehouse Film", logo_path: "/pine.png" },
				{ id: 2, name: "NOWFILM", logo_path: "/now.png" },
				{ id: 3, name: "Anonymous Content", logo_path: "/anon.png" },
			]),
		).toEqual([
			{
				id: 1,
				name: "Pinehouse Film",
				logoUrl: "https://image.tmdb.org/t/p/w185/pine.png",
			},
			{
				id: 2,
				name: "NOWFILM",
				logoUrl: "https://image.tmdb.org/t/p/w185/now.png",
			},
		]);
	});

	test("skips a company with no mark and still stops at two", () => {
		expect(
			movieStudioMarks([
				{ id: 1, name: "No Logo", logo_path: null },
				{ id: 2, name: "Warner Bros. Pictures", logo_path: "/wb.png" },
				{ id: 3, name: "Legendary Pictures", logo_path: "/leg.png" },
				{ id: 4, name: "Syncopy", logo_path: "/syn.png" },
			]).map((mark) => mark.name),
		).toEqual(["Warner Bros. Pictures", "Legendary Pictures"]);
	});

	test("drops a blank name", () => {
		expect(
			movieStudioMarks([{ id: 1, name: "   ", logo_path: "/x.png" }]),
		).toEqual([]);
	});
});

describe("movieStudioNameFallback", () => {
	test("stays quiet when a logo is already showing", () => {
		expect(
			movieStudioNameFallback([{ id: 1, name: "A24", logo_path: "/a24.png" }]),
		).toBeNull();
	});

	test("uses the first name when no company has a mark", () => {
		expect(
			movieStudioNameFallback([
				{ id: 1, name: "  ", logo_path: null },
				{ id: 2, name: "Small House", logo_path: null },
			]),
		).toEqual({ id: 2, name: "Small House" });
	});

	test("is empty when TMDb listed nobody", () => {
		expect(movieStudioNameFallback([])).toBeNull();
		expect(movieStudioNameFallback(null)).toBeNull();
	});
});

describe("studioSearchButtonLabel", () => {
	test("names films on a movie page and shows on a TV page", () => {
		expect(studioSearchButtonLabel("Pinehouse Film", "movie")).toBe(
			"Search films from Pinehouse Film",
		);
		expect(studioSearchButtonLabel("HBO", "tv")).toBe("Search shows from HBO");
	});
});
