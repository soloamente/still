import { db, log } from "@still/db";
import { and, eq, isNotNull } from "drizzle-orm";

import type {
	TasteMatchedDiscoveryPayload,
	TasteMatchMovie,
} from "./taste-matched-discovery";
import { TASTE_MATCH_MIN_RESULTS } from "./taste-matched-discovery";
import { fetchWatchlistMovieTmdbIds } from "./taste-watchlist-exclusion";

/** Defensive cap — diary + watchlist union for taste hero guard. */
const CONSUMED_MOVIE_CAP = 5000;

/**
 * Distinct movie TMDb ids the patron has watchlisted or logged in diary.
 * Used as the final guard on `/api/taste/for-you` responses.
 */
export async function fetchConsumedMovieTmdbIds(
	userId: string,
): Promise<number[]> {
	const [watchlistIds, logRows] = await Promise.all([
		fetchWatchlistMovieTmdbIds(userId),
		db
			.selectDistinct({ movieId: log.movieId })
			.from(log)
			.where(and(eq(log.userId, userId), isNotNull(log.movieId)))
			.limit(CONSUMED_MOVIE_CAP),
	]);

	const consumed = new Set<number>(watchlistIds);
	for (const row of logRows) {
		if (row.movieId != null) consumed.add(row.movieId);
	}
	return [...consumed];
}

/** Drop watchlisted or diary-logged titles from a taste hero/rail payload. */
export function filterConsumedTasteMovies(
	movies: TasteMatchMovie[],
	consumedTmdbIds: ReadonlySet<number>,
): TasteMatchMovie[] {
	if (consumedTmdbIds.size === 0) return movies;
	return movies.filter((row) => !consumedTmdbIds.has(row.tmdbId));
}

/**
 * Final server guard — never return watchlisted or diary-logged films in for-you.
 */
export async function finalizeTasteMatchedPayload(
	userId: string,
	payload: TasteMatchedDiscoveryPayload,
): Promise<TasteMatchedDiscoveryPayload> {
	const consumedTmdbIds = await fetchConsumedMovieTmdbIds(userId);
	const consumedSet = new Set(consumedTmdbIds);

	if (payload.coldStart || payload.movies.length === 0) {
		return { ...payload, consumedTmdbIds };
	}

	const movies = filterConsumedTasteMovies(payload.movies, consumedSet);
	if (movies.length < TASTE_MATCH_MIN_RESULTS) {
		return {
			coldStart: true,
			genrePhrase: null,
			movies: [],
			consumedTmdbIds,
		};
	}

	return {
		...payload,
		movies,
		consumedTmdbIds,
	};
}
