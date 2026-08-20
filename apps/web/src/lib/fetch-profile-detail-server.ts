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
		if (res.error) {
			if (process.env.NODE_ENV === "development") {
				console.error(
					"[fetchProfileDetailServer] API error",
					handle,
					res.status,
					res.error,
				);
			}
			return null;
		}
		return res.data ?? null;
	} catch (err) {
		if (process.env.NODE_ENV === "development") {
			console.error("[fetchProfileDetailServer] fetch failed", handle, err);
		}
		return null;
	}
});
