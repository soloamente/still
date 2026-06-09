import { describe, expect, test } from "bun:test";

import {
	compareSharePath,
	OG_DEFAULT_PATH,
	OG_HOME_PATH,
	ogComparePath,
	ogImageMetadataFields,
	ogListPath,
	ogTastePath,
	ogTitleMoviePath,
	ogTitleTvPath,
} from "./og-image-metadata";

describe("og image metadata", () => {
	test("builds canonical OG paths", () => {
		expect(OG_DEFAULT_PATH).toBe("/og/default");
		expect(OG_HOME_PATH).toBe("/og/home");
		expect(ogTitleMoviePath(550)).toBe("/og/title/movie/550");
		expect(ogTitleTvPath("1399")).toBe("/og/title/tv/1399");
		expect(ogTastePath("Ada")).toBe("/og/taste/ada");
		expect(ogListPath("lst_abc")).toBe("/og/list/lst_abc");
		expect(ogComparePath("Ada", "Bob")).toBe("/og/compare/ada/bob");
		expect(compareSharePath("Ada", "Bob")).toBe("/compare/ada/bob");
	});

	test("ogImageMetadataFields includes dimensions", () => {
		const fields = ogImageMetadataFields("/og/home", "Sense");
		expect(fields.openGraph?.images).toEqual([
			{
				url: "/og/home",
				width: 1200,
				height: 630,
				alt: "Sense",
			},
		]);
		expect(fields.twitter?.images).toEqual(["/og/home"]);
	});
});
