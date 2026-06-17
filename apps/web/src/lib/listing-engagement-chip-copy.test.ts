import { describe, expect, test } from "bun:test";

import {
	formatListingEngagementChipAriaLabel,
	formatListingEngagementChipTooltip,
} from "@/lib/listing-engagement-chip-copy";

describe("formatListingEngagementChipTooltip", () => {
	test("watched copy singular and plural", () => {
		expect(formatListingEngagementChipTooltip("watched", 1)).toBe(
			"Watched by 1 patron",
		);
		expect(formatListingEngagementChipTooltip("watched", 1537609)).toBe(
			"Watched by 1,537,609 patrons",
		);
	});

	test("lists copy singular and plural", () => {
		expect(formatListingEngagementChipTooltip("lists", 1)).toBe(
			"Appears in 1 list",
		);
		expect(formatListingEngagementChipTooltip("lists", 186)).toBe(
			"Appears in 186 lists",
		);
	});
});

describe("formatListingEngagementChipAriaLabel", () => {
	test("uses abbreviated count in aria label", () => {
		expect(formatListingEngagementChipAriaLabel("favorited", "504K")).toBe(
			"Favorited by 504K patrons",
		);
	});
});
