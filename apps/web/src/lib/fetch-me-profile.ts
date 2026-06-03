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
export const fetchMeProfile = cache(async (): Promise<MeProfile> => {
	try {
		const api = await serverApi();
		const res = await api.api.profiles.me.get();
		if (res.error || !res.data) return null;
		return res.data as MeProfile;
	} catch {
		return null;
	}
});
