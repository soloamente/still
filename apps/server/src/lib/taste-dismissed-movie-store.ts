import { db, movie, tasteDismissedMovie } from "@still/db";
import { desc, eq } from "drizzle-orm";

import { makeId } from "./cuid";

export type DismissedMovieMetadata = {
	movieTmdbId: number;
	genreIds: number[];
	year: number | null;
	originalLanguage: string | null;
	popularity: number | null;
};

/** Last N dismissals with movie metadata for negative scoring. */
export async function fetchDismissedMoviesWithMetadata(
	userId: string,
	limit = 50,
): Promise<DismissedMovieMetadata[]> {
	const rows = await db
		.select({
			movieTmdbId: tasteDismissedMovie.movieTmdbId,
			genreIds: movie.genreIds,
			year: movie.year,
			originalLanguage: movie.originalLanguage,
			popularity: movie.popularity,
		})
		.from(tasteDismissedMovie)
		.leftJoin(movie, eq(tasteDismissedMovie.movieTmdbId, movie.tmdbId))
		.where(eq(tasteDismissedMovie.userId, userId))
		.orderBy(desc(tasteDismissedMovie.dismissedAt))
		.limit(limit);

	return rows.map((row) => ({
		movieTmdbId: row.movieTmdbId,
		genreIds: (row.genreIds as number[] | undefined) ?? [],
		year: row.year,
		originalLanguage: row.originalLanguage,
		popularity: row.popularity,
	}));
}

/** All TMDb ids the patron has permanently dismissed from taste rails. */
export async function fetchDismissedMovieTmdbIds(
	userId: string,
): Promise<number[]> {
	const rows = await db
		.select({ movieTmdbId: tasteDismissedMovie.movieTmdbId })
		.from(tasteDismissedMovie)
		.where(eq(tasteDismissedMovie.userId, userId));
	return rows.map((row) => row.movieTmdbId);
}

/** Idempotent forever-dismiss row for a taste-rail title. */
export async function persistTasteDismissedMovie(args: {
	userId: string;
	movieTmdbId: number;
}): Promise<void> {
	await db
		.insert(tasteDismissedMovie)
		.values({
			id: makeId("tdm"),
			userId: args.userId,
			movieTmdbId: args.movieTmdbId,
		})
		.onConflictDoNothing();
}
