import { describe, expect, test } from "bun:test";

import { communityOffset, parseCommunityPage } from "./community-page-args";

describe("parseCommunityPage", () => {
	test("defaults to 1; floors; clamps to >= 1", () => {
		expect(parseCommunityPage(undefined)).toBe(1);
		expect(parseCommunityPage("0")).toBe(1);
		expect(parseCommunityPage("-3")).toBe(1);
		expect(parseCommunityPage("2.9")).toBe(2);
		expect(parseCommunityPage("nope")).toBe(1);
	});
});

describe("communityOffset", () => {
	test("page 1 => 0; page 3, limit 20 => 40", () => {
		expect(communityOffset(1, 20)).toBe(0);
		expect(communityOffset(3, 20)).toBe(40);
		expect(communityOffset(0, 20)).toBe(0);
	});
});
