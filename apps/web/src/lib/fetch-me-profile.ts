import "server-only";

import { cache } from "react";

import { serverApi } from "@/lib/server-api";

export type MeProfile = {
	handle: string;
	displayName: string;
	isPro: boolean;
	preferences: Record<string, unknown> | null;
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
