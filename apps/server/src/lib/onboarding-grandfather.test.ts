import { describe, expect, test } from "bun:test";

import {
	grandfatherOnboardedTimestamp,
	shouldGrandfatherLegacyOnboarding,
} from "./onboarding-grandfather";

const baseProfile = {
	handle: "patron",
	onboardedAt: null as Date | null,
	createdAt: new Date("2026-06-10T08:00:00.000Z"),
	updatedAt: new Date("2026-06-12T15:00:00.000Z"),
	tasteSignatureComputedAt: null as Date | null,
	favoriteMovieIds: [] as number[],
};

describe("shouldGrandfatherLegacyOnboarding", () => {
	test("skips when already onboarded", () => {
		expect(
			shouldGrandfatherLegacyOnboarding(
				{ ...baseProfile, onboardedAt: new Date() },
				0,
			),
		).toBe(false);
	});

	test("grandfathers pre-v3 profiles with a handle", () => {
		expect(shouldGrandfatherLegacyOnboarding(baseProfile, 0)).toBe(true);
	});

	test("does not grandfather same-day v3 mid-wizard (handle only)", () => {
		expect(
			shouldGrandfatherLegacyOnboarding(
				{
					...baseProfile,
					createdAt: new Date("2026-06-14T12:00:00.000Z"),
				},
				0,
			),
		).toBe(false);
	});

	test("grandfathers when diary logs exist", () => {
		expect(
			shouldGrandfatherLegacyOnboarding(
				{
					...baseProfile,
					createdAt: new Date("2026-06-14T12:00:00.000Z"),
				},
				3,
			),
		).toBe(true);
	});
});

describe("grandfatherOnboardedTimestamp", () => {
	test("prefers updatedAt over createdAt", () => {
		expect(grandfatherOnboardedTimestamp(baseProfile).toISOString()).toBe(
			"2026-06-12T15:00:00.000Z",
		);
	});
});
