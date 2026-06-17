import { describe, expect, test } from "bun:test";

import { formatEngagementCountAbbrev } from "@/lib/format-engagement-count";

describe("formatEngagementCountAbbrev", () => {
	test("formats sub-thousand counts literally", () => {
		expect(formatEngagementCountAbbrev(0)).toBe("0");
		expect(formatEngagementCountAbbrev(42)).toBe("42");
		expect(formatEngagementCountAbbrev(999)).toBe("999");
	});

	test("formats thousands with K suffix", () => {
		expect(formatEngagementCountAbbrev(1000)).toBe("1K");
		expect(formatEngagementCountAbbrev(1500)).toBe("1.5K");
		expect(formatEngagementCountAbbrev(186_000)).toBe("186K");
	});

	test("formats millions with M suffix", () => {
		expect(formatEngagementCountAbbrev(1_537_609)).toBe("1.5M");
		expect(formatEngagementCountAbbrev(5_040_000)).toBe("5M");
	});
});
