import { describe, expect, test } from "bun:test";

import { formatCommunityListsHeader } from "@/lib/community-lists-header";

describe("formatCommunityListsHeader", () => {
	test("formats count with plural", () => {
		expect(formatCommunityListsHeader(12)).toBe("12 popular lists");
	});

	test("uses singular for one list", () => {
		expect(formatCommunityListsHeader(1)).toBe("1 popular list");
	});

	test("clamps negative totals", () => {
		expect(formatCommunityListsHeader(-3)).toBe("0 popular lists");
	});
});
