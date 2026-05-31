import { db, log, movie, profile, tv } from "@still/db";
import { desc, eq } from "drizzle-orm";

import {
	computeTasteSignatureFromLogs,
	type TasteSignaturePayload,
} from "./sense-taste-signature";

const TASTE_SIGNATURE_LOG_LIMIT = 400;

/**
 * Rebuilds cached taste copy from the patron's diary and persists on `profile`.
 */
export async function recomputeUserTasteSignature(
	userId: string,
): Promise<TasteSignaturePayload> {
	const rows = await db
		.select({ log, movie, tv })
		.from(log)
		.leftJoin(movie, eq(log.movieId, movie.tmdbId))
		.leftJoin(tv, eq(log.tvId, tv.tmdbId))
		.where(eq(log.userId, userId))
		.orderBy(desc(log.watchedAt))
		.limit(TASTE_SIGNATURE_LOG_LIMIT);

	const slices = rows.map((row) => ({
		genreIds: [
			...((row.movie?.genreIds as number[] | undefined) ?? []),
			...((row.tv?.genreIds as number[] | undefined) ?? []),
		],
		rating: row.log.rating,
		tmdbVoteAverage: row.movie?.voteAverage ?? row.tv?.voteAverage ?? null,
		title: row.movie?.title ?? row.tv?.title ?? null,
	}));

	const payload = computeTasteSignatureFromLogs(slices);
	const now = new Date();

	await db
		.update(profile)
		.set({
			tasteSignature: payload,
			tasteSignatureComputedAt: now,
		})
		.where(eq(profile.userId, userId));

	return payload;
}
