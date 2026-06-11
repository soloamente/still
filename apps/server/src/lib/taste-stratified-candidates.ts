/**
 * Stratified solo candidate pool for the For you rail — per-genre slices
 * ordered by ascending popularity (deep cuts + mid-tier), not global top-N.
 */

import { db, movie } from "@still/db";
import { and, asc, isNotNull, notInArray, sql } from "drizzle-orm";

/** ~150 unseen titles per top genre affinity; cap total pool near 450. */
const PER_GENRE_LIMIT = 150;
const MAX_STRATIFIED_POOL = 450;
/** When genre slices are sparse, backfill with mid-popularity catalogue rows. */
const FALLBACK_LIMIT = 100;
const MIN_POOL_BEFORE_FALLBACK = 150;
/** Skip the least-popular tail so fallback skews mid-tier, not duplicate deep cuts. */
const MID_POPULARITY_OFFSET = 200;

const MOVIE_CANDIDATE_SELECT = {
	tmdbId: movie.tmdbId,
	title: movie.title,
	posterPath: movie.posterPath,
	year: movie.year,
	genreIds: movie.genreIds,
	originalLanguage: movie.originalLanguage,
	popularity: movie.popularity,
} as const;

export type StratifiedMovieCandidate = {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	year: number | null;
	genreIds: number[];
	originalLanguage: string | null;
	popularity: number | null;
};

type MovieCandidateRow = {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	year: number | null;
	genreIds: number[];
	originalLanguage: string | null;
	popularity: number | null;
};

function mapMovieRow(row: MovieCandidateRow): StratifiedMovieCandidate {
	return {
		tmdbId: row.tmdbId,
		title: row.title,
		posterPath: row.posterPath,
		year: row.year,
		genreIds: row.genreIds ?? [],
		originalLanguage: row.originalLanguage,
		popularity: row.popularity,
	};
}

function genreContainsFilter(genreId: number) {
	return sql`${movie.genreIds} @> ${JSON.stringify([genreId])}::jsonb`;
}

function excludeTmdbFilter(excludeTmdbIds: number[]) {
	return excludeTmdbIds.length > 0
		? notInArray(movie.tmdbId, excludeTmdbIds)
		: undefined;
}

/**
 * Loads stratified unseen catalogue rows for the viewer's top genre affinities.
 * Excludes logged and dismissed ids; dedupes across genre slices.
 */
export async function fetchStratifiedCandidates(args: {
	topGenreIds: number[];
	excludeTmdbIds: number[];
}): Promise<StratifiedMovieCandidate[]> {
	const seen = new Set<number>();
	const rows: StratifiedMovieCandidate[] = [];

	for (const genreId of args.topGenreIds.slice(0, 3)) {
		const genreRows = await db
			.select(MOVIE_CANDIDATE_SELECT)
			.from(movie)
			.where(
				and(
					isNotNull(movie.popularity),
					genreContainsFilter(genreId),
					excludeTmdbFilter(args.excludeTmdbIds),
				),
			)
			.orderBy(asc(movie.popularity))
			.limit(PER_GENRE_LIMIT);

		for (const row of genreRows) {
			if (seen.has(row.tmdbId)) continue;
			seen.add(row.tmdbId);
			rows.push(mapMovieRow(row));
		}
	}

	if (rows.length < MIN_POOL_BEFORE_FALLBACK) {
		const fallbackExclude = [...new Set([...args.excludeTmdbIds, ...seen])];
		const fallbackRows = await db
			.select(MOVIE_CANDIDATE_SELECT)
			.from(movie)
			.where(
				and(isNotNull(movie.popularity), excludeTmdbFilter(fallbackExclude)),
			)
			.orderBy(asc(movie.popularity))
			.offset(MID_POPULARITY_OFFSET)
			.limit(FALLBACK_LIMIT);

		for (const row of fallbackRows) {
			if (seen.has(row.tmdbId)) continue;
			seen.add(row.tmdbId);
			rows.push(mapMovieRow(row));
		}
	}

	return rows.slice(0, MAX_STRATIFIED_POOL);
}
