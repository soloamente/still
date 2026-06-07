import { describe, expect, test } from "bun:test";

import {
	listingDetailHeroSynopsisBlurb,
	resolveListingDetailHeroSynopsis,
} from "./listing-detail-hero-synopsis";

describe("resolveListingDetailHeroSynopsis", () => {
	test("returns trimmed overview", () => {
		expect(resolveListingDetailHeroSynopsis("  A mutant origin.  ")).toEqual({
			full: "A mutant origin.",
			preview: "A mutant origin.",
			isTruncated: false,
		});
	});

	test("marks long overviews as truncated", () => {
		const long = "a".repeat(300);
		const result = resolveListingDetailHeroSynopsis(long);
		expect(result?.isTruncated).toBe(true);
		expect(result?.full).toBe(long);
		expect(result?.preview.endsWith("…")).toBe(true);
		expect(result?.preview.length).toBeLessThanOrEqual(280);
	});

	test("returns null for empty overview", () => {
		expect(resolveListingDetailHeroSynopsis(null)).toBeNull();
		expect(resolveListingDetailHeroSynopsis("   ")).toBeNull();
	});
});

describe("listingDetailHeroSynopsisBlurb", () => {
	test("returns preview text", () => {
		const overview =
			"Charles Xavier and Erik Lehnsherr join forces to stop a threat to humanity.";
		expect(listingDetailHeroSynopsisBlurb(overview)).toBe(overview);
	});
});
