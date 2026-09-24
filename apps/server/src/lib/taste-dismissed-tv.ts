import { pickNextTasteMatchCandidate } from "./taste-dismissed-movie";
import { persistTasteDismissedTv } from "./taste-dismissed-tv-store";
import type { TasteMatchMovie } from "./taste-matched-discovery";

export { fetchDismissedTvTmdbIds } from "./taste-dismissed-tv-store";

/**
 * Persist a forever TV dismiss, then pick the next show from the full ranked
 * pool (not the MMR rail capped at 24). Skips on-screen ids, the dismissed
 * show, and every consumed show (logged, watchlist, dismissed). Cold start or
 * an empty pool returns `replacement: null`.
 */
export async function dismissTasteTv(args: {
	userId: string;
	tvTmdbId: number;
	excludeTmdbIds?: number[];
}): Promise<{ dismissedTmdbId: number; replacement: TasteMatchMovie | null }> {
	await persistTasteDismissedTv({
		userId: args.userId,
		tvTmdbId: args.tvTmdbId,
	});

	// The TV scorer imports `fetchDismissedTvTmdbIds` from this module, so a
	// static import here would cycle while the module is still initializing.
	const {
		enrichTvTasteMatchShows,
		scoreTasteMatchedTvCandidates,
		stampTvTastePayload,
	} = await import("./taste-matched-discovery-tv");
	const pool = await scoreTasteMatchedTvCandidates(args.userId);
	if (pool.coldStart || pool.scored.length === 0) {
		return { dismissedTmdbId: args.tvTmdbId, replacement: null };
	}

	const skip = new Set(args.excludeTmdbIds ?? []);
	skip.add(args.tvTmdbId);
	for (const id of pool.excludeIds) skip.add(id);

	const next = pickNextTasteMatchCandidate(pool.scored, {
		excludeTmdbIds: skip,
	});
	if (!next) {
		return { dismissedTmdbId: args.tvTmdbId, replacement: null };
	}

	const [enriched] = await enrichTvTasteMatchShows([next]);
	if (!enriched) {
		return { dismissedTmdbId: args.tvTmdbId, replacement: null };
	}

	const stamped = stampTvTastePayload({
		coldStart: false,
		genrePhrase: null,
		movies: [enriched],
	});
	return {
		dismissedTmdbId: args.tvTmdbId,
		replacement: stamped.movies[0] ?? null,
	};
}
