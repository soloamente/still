import { describe, expect, test } from "bun:test";
import {
	hasPatronFeature,
	type PlanFeatureKey,
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
		leaderboard_visibility: "immersed",
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
