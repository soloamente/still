import { describe, expect, test } from "bun:test";

import {
	isProfileShowcaseBadge,
	pickProfileShowcaseBadges,
	shouldNotifyBadgeAward,
} from "./badge-prestige";

const bronze = (id: string, category: string) => ({
	id,
	category,
	tier: "bronze",
	points: 10,
});

describe("badge-prestige", () => {
	test("hides volume milestone badges from profile showcase", () => {
		expect(isProfileShowcaseBadge(bronze("watch_1", "watch_milestone"))).toBe(
			true,
		);
		expect(isProfileShowcaseBadge(bronze("watch_10", "watch_milestone"))).toBe(
			false,
		);
		expect(isProfileShowcaseBadge(bronze("prestige_voice", "reviewer"))).toBe(
			true,
		);
	});

	test("shouldNotifyBadgeAward follows showcase rules", () => {
		expect(shouldNotifyBadgeAward(bronze("watch_100", "watch_milestone"))).toBe(
			false,
		);
		expect(shouldNotifyBadgeAward(bronze("rev_1", "reviewer"))).toBe(true);
	});

	test("pickProfileShowcaseBadges prefers higher prestige", () => {
		const rows = pickProfileShowcaseBadges([
			{ badge: bronze("watch_1", "watch_milestone") },
			{
				badge: {
					id: "prestige_voice",
					category: "reviewer",
					tier: "gold",
					points: 80,
				},
			},
			{ badge: bronze("watch_10", "watch_milestone") },
		]);
		expect(rows.map((r) => r.badge.id)).toEqual(["prestige_voice", "watch_1"]);
	});
});
