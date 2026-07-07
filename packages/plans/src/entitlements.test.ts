import { describe, expect, test } from "bun:test";
import {
	hasPatronFeature,
	hasPatronFeatureForTier,
	MIN_TIER_FOR_FEATURE,
	type PlanFeatureKey,
	parsePlanFeatureKeys,
	parsePlanTierId,
	resolveEffectiveTier,
} from "./index";

describe("resolveEffectiveTier", () => {
	test("planOverride wins over subscriptionTier", () => {
		expect(
			resolveEffectiveTier({
				subscriptionTier: "attuned",
				planOverride: "devoted",
			}),
		).toBe("devoted");
	});
	test("defaults to still", () => {
		expect(
			resolveEffectiveTier({ subscriptionTier: "still", planOverride: null }),
		).toBe("still");
	});
});

describe("hasPatronFeature", () => {
	const minTierFor: Record<PlanFeatureKey, "attuned" | "immersed"> = {
		taste_signature: "attuned",
		all_themes: "immersed",
		full_stats: "attuned",
		activity_signature: "attuned",
		streaming_filters: "attuned",
		watchlist_alerts: "attuned",
		profile_customization: "immersed",
		pinned_reviews: "immersed",
		list_covers: "immersed",
		private_lists: "immersed",
		taste_overlap: "immersed",
		badge_prestige: "immersed",
		challenges: "immersed",
		leaderboard_visibility: "still",
	};

	test("still user blocked from attuned feature", () => {
		expect(
			hasPatronFeature({
				effectiveTier: "still",
				grants: [],
				featureKey: "taste_signature",
				minTierFor,
			}),
		).toBe(false);
	});

	test("grant-only extra unlocks above tier", () => {
		expect(
			hasPatronFeature({
				effectiveTier: "still",
				grants: ["taste_overlap"],
				featureKey: "taste_overlap",
				minTierFor,
			}),
		).toBe(true);
	});

	test("immersed includes attuned features via rank", () => {
		expect(
			hasPatronFeature({
				effectiveTier: "immersed",
				grants: [],
				featureKey: "taste_signature",
				minTierFor,
			}),
		).toBe(true);
	});
});

describe("MIN_TIER_FOR_FEATURE", () => {
	test("covers all 14 feature keys", () => {
		const keys: PlanFeatureKey[] = [
			"full_stats",
			"taste_signature",
			"activity_signature",
			"streaming_filters",
			"watchlist_alerts",
			"all_themes",
			"profile_customization",
			"pinned_reviews",
			"list_covers",
			"private_lists",
			"taste_overlap",
			"badge_prestige",
			"challenges",
			"leaderboard_visibility",
		];
		expect(Object.keys(MIN_TIER_FOR_FEATURE)).toHaveLength(14);
		for (const key of keys) {
			expect(MIN_TIER_FOR_FEATURE[key]).toBeDefined();
		}
	});

	test("attuned features require attuned tier", () => {
		for (const key of [
			"full_stats",
			"taste_signature",
			"activity_signature",
			"streaming_filters",
			"watchlist_alerts",
		] as const) {
			expect(MIN_TIER_FOR_FEATURE[key]).toBe("attuned");
		}
	});

	test("immersed features require immersed tier", () => {
		for (const key of [
			"all_themes",
			"profile_customization",
			"pinned_reviews",
			"list_covers",
			"private_lists",
			"taste_overlap",
			"badge_prestige",
			"challenges",
		] as const) {
			expect(MIN_TIER_FOR_FEATURE[key]).toBe("immersed");
		}
	});

	test("leaderboard visibility is included on still", () => {
		expect(MIN_TIER_FOR_FEATURE.leaderboard_visibility).toBe("still");
	});
});

describe("hasPatronFeatureForTier", () => {
	test("uses MIN_TIER_FOR_FEATURE for tier gates", () => {
		expect(
			hasPatronFeatureForTier({
				effectiveTier: "still",
				grants: [],
				featureKey: "all_themes",
			}),
		).toBe(false);
		expect(
			hasPatronFeatureForTier({
				effectiveTier: "immersed",
				grants: [],
				featureKey: "all_themes",
			}),
		).toBe(true);
	});
});

describe("parsePlanTierId", () => {
	test("accepts valid tiers", () => {
		expect(parsePlanTierId("attuned")).toBe("attuned");
	});
	test("invalid values default to still", () => {
		expect(parsePlanTierId("invalid")).toBe("still");
		expect(parsePlanTierId(null)).toBe("still");
	});
});

describe("parsePlanFeatureKeys", () => {
	test("filters unknown grant keys", () => {
		expect(parsePlanFeatureKeys(["all_themes", "bogus"])).toEqual([
			"all_themes",
		]);
	});
});
