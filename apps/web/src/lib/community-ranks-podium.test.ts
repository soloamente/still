import { describe, expect, test } from "bun:test";

import {
	COMMUNITY_RANKS_PODIUM_BADGE_CLASSNAME,
	COMMUNITY_RANKS_PODIUM_CTA_CLASSNAME,
	COMMUNITY_RANKS_PODIUM_PEDESTAL_CTA_CLASSNAME,
	communityRanksPodiumBadgeDigit,
	communityRanksPodiumFilled,
	communityRanksPodiumPedestalButtonClass,
	communityRanksPodiumPedestalClass,
	communityRanksPodiumPedestalHeightClass,
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

describe("communityRanksPodiumPedestalHeightClass", () => {
	test("1st is taller than 2nd and 3rd", () => {
		expect(communityRanksPodiumPedestalHeightClass("first")).toContain("h-22");
		expect(communityRanksPodiumPedestalHeightClass("second")).toContain("h-18");
		expect(communityRanksPodiumPedestalHeightClass("third")).toContain("h-16");
	});
});

describe("COMMUNITY_RANKS_PODIUM_BADGE_CLASSNAME", () => {
	test("hangs on the pillar lip so it cannot sit over the count", () => {
		expect(COMMUNITY_RANKS_PODIUM_BADGE_CLASSNAME).toContain("top-0");
		expect(COMMUNITY_RANKS_PODIUM_BADGE_CLASSNAME).toContain(
			"-translate-y-1/2",
		);
	});
});

describe("communityRanksPodiumPedestalButtonClass", () => {
	test("third pedestal stays relative and centers count without pt-10", () => {
		const third = communityRanksPodiumPedestalButtonClass("third");
		expect(third).toContain("relative");
		expect(third).toContain("justify-center");
		expect(third.split(/\s+/).includes("pt-10")).toBe(false);
	});
});

describe("communityRanksPodiumPedestalClass", () => {
	test("three medal materials are distinct", () => {
		const first = communityRanksPodiumPedestalClass("first");
		const second = communityRanksPodiumPedestalClass("second");
		const third = communityRanksPodiumPedestalClass("third");
		expect(first).not.toBe(second);
		expect(second).not.toBe(third);
		expect(first).toContain("linear-gradient");
		expect(third).toContain("desert-orange");
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
	test("rank rows keep muted foreground; pedestals use zinc on medal faces", () => {
		expect(COMMUNITY_RANKS_PODIUM_CTA_CLASSNAME).toContain(
			"text-foreground/75",
		);
		expect(COMMUNITY_RANKS_PODIUM_PEDESTAL_CTA_CLASSNAME).toContain(
			"text-zinc-950/70",
		);
		expect(COMMUNITY_RANKS_PODIUM_PEDESTAL_CTA_CLASSNAME).not.toContain(
			"text-foreground/75",
		);
	});
});
