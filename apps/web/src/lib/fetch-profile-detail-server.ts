import "server-only";

import { cache } from "react";
import { serverApi } from "@/lib/server-api";

/**
 * React-cached GET /api/profiles/:handle — executes at most once per RSC render pass.
 * Deduplicates the call between generateMetadata and the page component.
 */
export const fetchProfileDetailServer = cache(async (handle: string) => {
	try {
		const api = await serverApi();
		const res = await api.api.profiles({ handle }).get();
		return res.data ?? null;
	} catch {
		return null;
	}
});
