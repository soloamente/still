import { describe, expect, test } from "bun:test";

import { mergeReferralRewardsPref } from "./referral-rewards-pref";

describe("mergeReferralRewardsPref", () => {
	test("creates referralRewards object when missing", () => {
		expect(mergeReferralRewardsPref(null, { scoutBadge: true })).toEqual({
			referralRewards: { scoutBadge: true },
		});
	});

	test("merges without dropping prior perks", () => {
		expect(
			mergeReferralRewardsPref(
				{ referralRewards: { scoutBadge: true } },
				{ connectorFrame: true },
			),
		).toEqual({
			referralRewards: { scoutBadge: true, connectorFrame: true },
		});
	});
});
