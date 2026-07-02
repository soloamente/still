import { recordProductEvent } from "./record-product-event";
import { fetchConsumedMovieTmdbIds } from "./taste-consumed-movies";
import { persistTasteDismissedMovie } from "./taste-dismissed-movie-store";
import { enrichTasteMatchMovies } from "./taste-match-enrichment";
import {
	scoreTasteMatchCandidatesForUser,
	type TasteMatchMovie,
} from "./taste-matched-discovery";

export { fetchDismissedMovieTmdbIds } from "./taste-dismissed-movie-store";

export type ScoredTasteMatchEntry = {
	row: TasteMatchMovie;
	score: number;
};

/**
 * Pick the next taste-matched title from a score-sorted pool, skipping on-screen
 * and already-excluded ids.
 */
export function pickNextTasteMatchCandidate(
	scored: ScoredTasteMatchEntry[],
	options: { excludeTmdbIds: Set<number> },
): TasteMatchMovie | null {
	for (const entry of scored) {
		if (options.excludeTmdbIds.has(entry.row.tmdbId)) continue;
		return entry.row;
	}
	return null;
}

/** Persist a forever dismiss and return the next replacement candidate if any. */
export async function dismissTasteMovie(args: {
	userId: string;
	movieTmdbId: number;
	excludeTmdbIds?: number[];
}): Promise<{ dismissedTmdbId: number; replacement: TasteMatchMovie | null }> {
	await persistTasteDismissedMovie({
		userId: args.userId,
		movieTmdbId: args.movieTmdbId,
	});

	await recordProductEvent(args.userId, "taste.dismissed", {
		movieTmdbId: args.movieTmdbId,
	});

	const scoredResult = await scoreTasteMatchCandidatesForUser(args.userId);
	if (scoredResult.coldStart) {
		return { dismissedTmdbId: args.movieTmdbId, replacement: null };
	}

	const onScreen = new Set(args.excludeTmdbIds ?? []);
	onScreen.add(args.movieTmdbId);
	const consumedIds = await fetchConsumedMovieTmdbIds(args.userId);
	for (const id of consumedIds) onScreen.add(id);

	const replacement = pickNextTasteMatchCandidate(scoredResult.scored, {
		excludeTmdbIds: onScreen,
	});

	const enrichedReplacement = replacement
		? ((await enrichTasteMatchMovies([replacement]))[0] ?? null)
		: null;

	return {
		dismissedTmdbId: args.movieTmdbId,
		replacement: enrichedReplacement,
	};
}
