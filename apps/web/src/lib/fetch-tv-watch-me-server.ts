import "server-only";

import { serverApi } from "@/lib/server-api";
import type { TvWatchBundle } from "@/lib/tv-watch-types";

type ServerApiClient = Awaited<ReturnType<typeof serverApi>>;

/**
 * RSC helper — active TV watches for the home continue-watching rail.
 * Forwards session cookies via Eden (`GET /api/tv-watch/me`).
 */
export async function fetchTvWatchMeServer(
	api?: ServerApiClient,
	opts?: { status?: string; limit?: number },
): Promise<TvWatchBundle[]> {
	const client = api ?? (await serverApi());
	try {
		const res = await client.api["tv-watch"].me.get({
			query: {
				...(opts?.status ? { status: opts.status } : {}),
				...(opts?.limit != null ? { limit: String(opts.limit) } : {}),
			},
		});
		if (res.error != null) {
			console.error(
				"[fetchTvWatchMeServer] GET /api/tv-watch/me failed:",
				res.error,
			);
			return [];
		}
		// Eden may return Drizzle `Date` fields — consumers expect ISO strings on `TvWatchRow`.
		return (res.data as unknown as TvWatchBundle[] | null) ?? [];
	} catch (err) {
		console.error("[fetchTvWatchMeServer]", err);
		return [];
	}
}
