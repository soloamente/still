import { describe, expect, test } from "bun:test";

import { orderCountryRowsByPreferredRegion } from "@/lib/movie-watch-providers";

describe("orderCountryRowsByPreferredRegion", () => {
	const rows = [
		{ countryCode: "AU", countryName: "Australia" },
		{ countryCode: "IT", countryName: "Italy" },
		{ countryCode: "US", countryName: "United States" },
	];

	test("pins preferred ISO2 to the top", () => {
		expect(orderCountryRowsByPreferredRegion(rows, "IT")).toEqual([
			{ countryCode: "IT", countryName: "Italy" },
			{ countryCode: "AU", countryName: "Australia" },
			{ countryCode: "US", countryName: "United States" },
		]);
	});

	test("is case-insensitive and trims", () => {
		expect(orderCountryRowsByPreferredRegion(rows, " us ")).toEqual([
			{ countryCode: "US", countryName: "United States" },
			{ countryCode: "AU", countryName: "Australia" },
			{ countryCode: "IT", countryName: "Italy" },
		]);
	});

	test("no-ops when unset, already first, or missing", () => {
		expect(orderCountryRowsByPreferredRegion(rows, null)).toEqual(rows);
		expect(orderCountryRowsByPreferredRegion(rows, "AU")).toEqual(rows);
		expect(orderCountryRowsByPreferredRegion(rows, "DE")).toEqual(rows);
	});
});
