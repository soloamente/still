import { describe, expect, test } from "bun:test";

import { pickTitleLogoPath } from "./tmdb-title-logo";

describe("pickTitleLogoPath", () => {
	test("prefers English horizontal wordmarks", () => {
		const path = pickTitleLogoPath([
			{
				file_path: "/ja-tall.png",
				iso_639_1: "ja",
				width: 200,
				height: 400,
				vote_average: 5,
			},
			{
				file_path: "/en-wide.png",
				iso_639_1: "en",
				width: 800,
				height: 200,
				vote_average: 1,
			},
		]);
		expect(path).toBe("/en-wide.png");
	});

	test("falls back to language-neutral logos", () => {
		const path = pickTitleLogoPath([
			{
				file_path: "/neutral.png",
				iso_639_1: null,
				width: 600,
				height: 180,
				vote_average: 2,
			},
		]);
		expect(path).toBe("/neutral.png");
	});
});
