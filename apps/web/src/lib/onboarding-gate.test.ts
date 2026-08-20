import { describe, expect, test } from "bun:test";

import {
	patronNeedsOnboarding,
	resolveOnboardingResumeStep,
} from "@/lib/onboarding-gate";

describe("patronNeedsOnboarding", () => {
	test("requires onboarding when profile is missing", () => {
		expect(patronNeedsOnboarding(null)).toBe(true);
	});

	test("requires onboarding when handle saved but not onboarded (v3 mid-wizard)", () => {
		expect(
			patronNeedsOnboarding({
				handle: "alessandro",
				onboardedAt: null,
				createdAt: "2026-06-14T12:00:00.000Z",
			}),
		).toBe(true);
	});

	test("allows app when onboardedAt is set", () => {
		expect(
			patronNeedsOnboarding({
				onboardedAt: "2026-06-14T12:00:00.000Z",
				handle: "alessandro",
			}),
		).toBe(false);
	});

	test("grandfathers legacy patrons created before wizard v3", () => {
		expect(
			patronNeedsOnboarding({
				handle: "legacy",
				onboardedAt: null,
				createdAt: "2026-06-10T08:00:00.000Z",
			}),
		).toBe(false);
	});

	test("keeps post-v3 patrons gated even with diary (import step still unfinished)", () => {
		expect(
			patronNeedsOnboarding({
				handle: "diary",
				onboardedAt: null,
				createdAt: "2026-06-14T12:00:00.000Z",
				diaryMetalTier: "silver",
			}),
		).toBe(true);
	});

	test("keeps post-v3 patrons gated even with taste signature before Enter", () => {
		expect(
			patronNeedsOnboarding({
				handle: "taste",
				onboardedAt: null,
				createdAt: "2026-06-14T12:00:00.000Z",
				tasteSignatureComputedAt: "2026-06-14T13:00:00.000Z",
			}),
		).toBe(true);
	});

	test("keeps post-v3 patrons gated after favorites save without markOnboarded", () => {
		expect(
			patronNeedsOnboarding({
				handle: "favs",
				onboardedAt: null,
				createdAt: "2026-06-14T12:00:00.000Z",
				favoriteMovieIds: [550, 278],
				tasteSignatureComputedAt: "2026-06-14T13:00:00.000Z",
				diaryMetalTier: "bronze",
			}),
		).toBe(true);
	});
});

describe("resolveOnboardingResumeStep", () => {
	test("resumes at bio when handle was saved mid-wizard", () => {
		expect(resolveOnboardingResumeStep("alessandro")).toBe("bio");
	});

	test("starts at welcome when handle is not saved yet", () => {
		expect(resolveOnboardingResumeStep("")).toBe("welcome");
	});
});
