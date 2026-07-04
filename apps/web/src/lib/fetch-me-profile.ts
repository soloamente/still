import "server-only";

import type { PlanFeatureKey, PlanTierId } from "@still/plans";
import { cache } from "react";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import { serverApi } from "@/lib/server-api";

export type MeProfile = {
	handle: string;
	displayName: string;
	/** Fresh portrait URL from `user.image` (nav uses this over stale session). */
	image?: string | null;
	subscriptionTier?: PlanTierId;
	planOverride?: PlanTierId | null;
	effectiveTier?: PlanTierId;
	featureGrants?: PlanFeatureKey[];
	/** Computed from API — hasFeature("all_themes") compat shim until Task 15. */
	isPro: boolean;
	onboardedAt?: string | Date | null;
	createdAt?: string | Date | null;
	tasteSignatureComputedAt?: string | Date | null;
	favoriteMovieIds?: readonly unknown[] | null;
	preferences: Record<string, unknown> | null;
	diaryMetalTier?: DiaryMetalTier | null;
} | null;

/**
 * React-cached GET /api/profiles/me — executes at most once per RSC render pass
 * regardless of how many server components call it.
 */
/** Sentinel returned when the API call fails (network error, 5xx, etc.). */
export const PROFILE_FETCH_FAILED = Symbol("PROFILE_FETCH_FAILED");

export const fetchMeProfile = cache(
	async (): Promise<MeProfile | typeof PROFILE_FETCH_FAILED> => {
		try {
			const api = await serverApi();
			const res = await api.api.profiles.me.get();
			if (res.error || !res.data) return null;
			return res.data as MeProfile;
		} catch {
			return PROFILE_FETCH_FAILED;
		}
	},
);
