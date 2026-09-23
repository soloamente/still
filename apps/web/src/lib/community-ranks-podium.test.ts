import { describe, expect, test } from "bun:test";

import {
	COMMUNITY_RANKS_PODIUM_CTA_CLASSNAME,
	COMMUNITY_RANKS_PODIUM_STAGE_CLASSNAME,
	communityRanksPodiumBadgeDigit,
	communityRanksPodiumCountButtonClass,
	communityRanksPodiumFilled,
	communityRanksPodiumSlotLabel,
} from "./community-ranks-podium";

describe("communityRanksPodiumBadgeDigit", () => {
	test("maps slots to 1 2 3", () => {
		expect(communityRanksPodiumBadgeDigit("first")).toBe("1");
		expect(communityRanksPodiumBadgeDigit("second")).toBe("2");
		expect(communityRanksPodiumBadgeDigit("third")).toBe("3");
	});
});

describe("communityRanksPodiumSlotLabel", () => {
	test("stays 1st 2nd 3rd for SR", () => {
		expect(communityRanksPodiumSlotLabel("first")).toBe("1st");
		expect(communityRanksPodiumSlotLabel("second")).toBe("2nd");
		expect(communityRanksPodiumSlotLabel("third")).toBe("3rd");
	});
});

describe("communityRanksPodiumCountButtonClass", () => {
	test("uses Sense surface depth — no medal gradients or pedestal heights", () => {
		const first = communityRanksPodiumCountButtonClass("first");
		const second = communityRanksPodiumCountButtonClass("second");
		const third = communityRanksPodiumCountButtonClass("third");

		for (const cls of [first, second, third]) {
			expect(cls).toContain("bg-background");
			expect(cls).toContain("rounded-2xl");
			expect(cls).not.toContain("linear-gradient");
			expect(cls).not.toContain("desert-orange");
			expect(cls).not.toMatch(/\bh-1[68]\b|\bh-2[26]\b/);
		}
	});

	test("same quiet control chrome for every place", () => {
		// Hierarchy lives in portrait size + count type — not gold/silver/bronze blocks.
		const first = communityRanksPodiumCountButtonClass("first");
		const second = communityRanksPodiumCountButtonClass("second");
		expect(first).toBe(second);
	});
});

describe("COMMUNITY_RANKS_PODIUM_STAGE_CLASSNAME", () => {
	test("aligns columns from the top — no pedestal stage floor", () => {
		expect(COMMUNITY_RANKS_PODIUM_STAGE_CLASSNAME).toContain("items-start");
		expect(COMMUNITY_RANKS_PODIUM_STAGE_CLASSNAME).not.toContain("items-end");
	});
});

describe("communityRanksPodiumFilled", () => {
	test("returns null without a first entry", () => {
		expect(communityRanksPodiumFilled([])).toBeNull();
	});

	test("does not invent second or third", () => {
		const filled = communityRanksPodiumFilled([{ id: "a" }]);
		expect(filled?.first).toEqual({ id: "a" });
		expect(filled?.second).toBeUndefined();
		expect(filled?.third).toBeUndefined();
	});
});

describe("podium CTA contrast", () => {
	test("rank rows and podium share muted foreground CTA ink", () => {
		expect(COMMUNITY_RANKS_PODIUM_CTA_CLASSNAME).toContain(
			"text-foreground/75",
		);
	});
});
