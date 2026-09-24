import { persistTasteDismissedTv } from "./taste-dismissed-tv-store";
import type { TasteMatchMovie } from "./taste-matched-discovery";

export { fetchDismissedTvTmdbIds } from "./taste-dismissed-tv-store";

/**
 * Persist a forever TV dismiss, then pick the next TV for-you title.
 * Skips on-screen ids plus the show just dismissed. Cold start or an empty
 * rail returns `replacement: null`.
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
	const { buildTasteMatchedDiscoveryForTv } = await import(
		"./taste-matched-discovery-tv"
	);
	const payload = await buildTasteMatchedDiscoveryForTv(args.userId);
	if (payload.coldStart || payload.movies.length === 0) {
		return { dismissedTmdbId: args.tvTmdbId, replacement: null };
	}

	const skip = new Set(args.excludeTmdbIds ?? []);
	skip.add(args.tvTmdbId);
	const replacement =
		payload.movies.find((movie) => !skip.has(movie.tmdbId)) ?? null;

	return {
		dismissedTmdbId: args.tvTmdbId,
		replacement,
	};
}
