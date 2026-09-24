/**
 * Stratified solo candidate pool for the TV For you rail — per-genre slices
 * ordered by ascending popularity (deep cuts + mid-tier), not global top-N.
 * Copy of the movie loader with the `tv` table in place of `movie`.
 */

import { db, tv } from "@still/db";
import { and, asc, isNotNull, notInArray, sql } from "drizzle-orm";

/** ~150 unseen titles per top genre affinity; cap total pool near 450. */
const PER_GENRE_LIMIT = 150;
const MAX_STRATIFIED_POOL = 450;
/** When genre slices are sparse, backfill with mid-popularity catalogue rows. */
const FALLBACK_LIMIT = 100;
const MIN_POOL_BEFORE_FALLBACK = 150;
/** Skip the least-popular tail so fallback skews mid-tier, not duplicate deep cuts. */
const MID_POPULARITY_OFFSET = 200;

const TV_CANDIDATE_SELECT = {
	tmdbId: tv.tmdbId,
	title: tv.title,
	posterPath: tv.posterPath,
	backdropPath: tv.backdropPath,
	year: tv.year,
	genreIds: tv.genreIds,
	originalLanguage: tv.originalLanguage,
	popularity: tv.popularity,
} as const;

export type StratifiedTvCandidate = {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	backdropPath: string | null;
	year: number | null;
	genreIds: number[];
	originalLanguage: string | null;
	popularity: number | null;
};

type TvCandidateRow = {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	backdropPath: string | null;
	year: number | null;
	genreIds: number[];
	originalLanguage: string | null;
	popularity: number | null;
};

function mapTvRow(row: TvCandidateRow): StratifiedTvCandidate {
	return {
		tmdbId: row.tmdbId,
		title: row.title,
		posterPath: row.posterPath,
		backdropPath: row.backdropPath,
		year: row.year,
		genreIds: row.genreIds ?? [],
		originalLanguage: row.originalLanguage,
		popularity: row.popularity,
	};
}

function genreContainsFilter(genreId: number) {
	return sql`${tv.genreIds} @> ${JSON.stringify([genreId])}::jsonb`;
}

function excludeTmdbFilter(excludeTmdbIds: number[]) {
	return excludeTmdbIds.length > 0
		? notInArray(tv.tmdbId, excludeTmdbIds)
		: undefined;
}

/**
 * Loads stratified unseen TV catalogue rows for the viewer's top genre affinities.
 * Excludes logged and dismissed show ids; dedupes across genre slices.
 * Scalars only — never `tv.tmdbJson`.
 */
export async function fetchStratifiedTvCandidates(args: {
	topGenreIds: number[];
	excludeTmdbIds: number[];
}): Promise<StratifiedTvCandidate[]> {
	const seen = new Set<number>();
	const rows: StratifiedTvCandidate[] = [];

	for (const genreId of args.topGenreIds.slice(0, 3)) {
		const genreRows = await db
			.select(TV_CANDIDATE_SELECT)
			.from(tv)
			.where(
				and(
					isNotNull(tv.popularity),
					genreContainsFilter(genreId),
					excludeTmdbFilter(args.excludeTmdbIds),
				),
			)
			.orderBy(asc(tv.popularity))
			.limit(PER_GENRE_LIMIT);

		for (const row of genreRows) {
			if (seen.has(row.tmdbId)) continue;
			seen.add(row.tmdbId);
			rows.push(mapTvRow(row));
		}
	}

	if (rows.length < MIN_POOL_BEFORE_FALLBACK) {
		const fallbackExclude = [...new Set([...args.excludeTmdbIds, ...seen])];
		const fallbackRows = await db
			.select(TV_CANDIDATE_SELECT)
			.from(tv)
			.where(and(isNotNull(tv.popularity), excludeTmdbFilter(fallbackExclude)))
			.orderBy(asc(tv.popularity))
			.offset(MID_POPULARITY_OFFSET)
			.limit(FALLBACK_LIMIT);

		for (const row of fallbackRows) {
			if (seen.has(row.tmdbId)) continue;
			seen.add(row.tmdbId);
			rows.push(mapTvRow(row));
		}
	}

	return rows.slice(0, MAX_STRATIFIED_POOL);
}
