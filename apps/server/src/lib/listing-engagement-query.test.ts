import { describe, expect, test } from "bun:test";

import {
	formatListingEngagementPrivateGapFooter,
	listingEngagementHasMore,
	parseListingEngagementLimit,
	parseListingEngagementPage,
} from "./listing-engagement-query";

describe("parseListingEngagementLimit", () => {
	test("defaults to 20 and caps at 50", () => {
		expect(parseListingEngagementLimit(undefined)).toBe(20);
		expect(parseListingEngagementLimit("99")).toBe(50);
		expect(parseListingEngagementLimit("12")).toBe(12);
	});
});

describe("parseListingEngagementPage", () => {
	test("defaults invalid pages to 1", () => {
		expect(parseListingEngagementPage(undefined)).toBe(1);
		expect(parseListingEngagementPage("0")).toBe(1);
		expect(parseListingEngagementPage("3")).toBe(3);
	});
});

describe("listingEngagementHasMore", () => {
	test("detects extra probe row", () => {
		expect(listingEngagementHasMore(21, 20)).toBe(true);
		expect(listingEngagementHasMore(20, 20)).toBe(false);
	});
});

describe("formatListingEngagementPrivateGapFooter", () => {
	test("returns null when counts match", () => {
		expect(
			formatListingEngagementPrivateGapFooter({
				kind: "watches",
				totalVisible: 10,
				totalGlobal: 10,
			}),
		).toBeNull();
	});

	test("watched copy names patrons and private gap", () => {
		expect(
			formatListingEngagementPrivateGapFooter({
				kind: "watches",
				totalVisible: 4,
				totalGlobal: 12,
			}),
		).toBe("4 patrons you can see · 8 more with private activity");
	});

	test("lists copy names lists gap", () => {
		expect(
			formatListingEngagementPrivateGapFooter({
				kind: "lists",
				totalVisible: 2,
				totalGlobal: 9,
			}),
		).toBe("2 lists you can see · 7 more with private activity");
	});
});
