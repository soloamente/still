import { db, tasteDismissedMovie } from "@still/db";
import { eq } from "drizzle-orm";

import { makeId } from "./cuid";

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
