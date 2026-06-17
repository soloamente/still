import "server-only";

import { cache } from "react";
import { serverApi } from "@/lib/server-api";

/**
 * React-cached GET /api/movies/:id — executes at most once per RSC render pass.
 * Deduplicates the call between generateMetadata and the page component.
 */
export const fetchMovieDetailServer = cache(async (id: string) => {
	try {
		const api = await serverApi();
		const res = await api.api.movies({ id }).get();
		return res.data ?? null;
	} catch {
		return null;
	}
});
