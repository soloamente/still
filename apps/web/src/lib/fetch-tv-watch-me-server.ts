import "server-only";

import { serverApi } from "@/lib/server-api";
import type { TvWatchBundle } from "@/lib/tv-watch-types";

type ServerApiClient = Awaited<ReturnType<typeof serverApi>>;

type TvWatchMeOpts = { status?: string; limit?: number };

/**
 * RSC helper — active TV watches plus a `failed` flag so callers (e.g. `/watchlist`
 * Continue watching) can show an error state instead of an empty one.
 * Forwards session cookies via Eden (`GET /api/tv-watch/me`).
 */
export async function fetchTvWatchMeServerResult(
	api?: ServerApiClient,
	opts?: TvWatchMeOpts,
): Promise<{ bundles: TvWatchBundle[]; failed: boolean }> {
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
			return { bundles: [], failed: true };
		}
		// Eden may return Drizzle `Date` fields — consumers expect ISO strings on `TvWatchRow`.
		return {
			bundles: (res.data as unknown as TvWatchBundle[] | null) ?? [],
			failed: false,
		};
	} catch (err) {
		console.error("[fetchTvWatchMeServer]", err);
		return { bundles: [], failed: true };
	}
}

/**
 * RSC helper — active TV watches for the home continue-watching rail.
 * Errors collapse to `[]` (the rail simply hides).
 */
export async function fetchTvWatchMeServer(
	api?: ServerApiClient,
	opts?: TvWatchMeOpts,
): Promise<TvWatchBundle[]> {
	return (await fetchTvWatchMeServerResult(api, opts)).bundles;
}
