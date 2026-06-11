/**
 * Social candidate pool for the For you rail — high-rated neighbor diary picks
 * weighted by taste compatibility.
 */

import { db, log, movie } from "@still/db";

import {
	and,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	notInArray,
} from "drizzle-orm";

import { contentVisibilityWhere } from "./content-visibility";

import { storedRatingToDisplayTen } from "./sense-taste-overlap";
import type { TasteNeighbor } from "./taste-neighbor-discovery";
import { ratingAffinityWeight } from "./taste-scoring-math";

/** Neighbor logs below this display rating are ignored for social signal. */

const SOCIAL_MIN_RATING_DISPLAY = 7;

/** Cap batch size — enough neighbor signal without scanning full diaries. */

const SOCIAL_LOG_BATCH_LIMIT = 400;

export type SocialMovieCandidate = {
	tmdbId: number;

	title: string;

	posterPath: string | null;

	year: number | null;

	genreIds: number[];

	originalLanguage: string | null;

	popularity: number | null;

	socialScore: number;
};

/**
 * Batch-loads neighbor movie logs rated ≥7.0 (display) that the viewer may see.
 * Keeps the strongest socialScore per tmdbId across neighbors.
 */

export async function fetchSocialCandidates(args: {
	viewerId: string;

	neighbors: TasteNeighbor[];

	excludeTmdbIds: number[];
}): Promise<Map<number, SocialMovieCandidate>> {
	const best = new Map<number, SocialMovieCandidate>();

	if (args.neighbors.length === 0) return best;

	const neighborIds = args.neighbors.map((neighbor) => neighbor.userId);

	const compatById = new Map(
		args.neighbors.map((neighbor) => [
			neighbor.userId,

			neighbor.compatibilityPercent,
		]),
	);

	const rows = await db

		.select({ log, movie })

		.from(log)

		.innerJoin(movie, eq(log.movieId, movie.tmdbId))

		.where(
			and(
				inArray(log.userId, neighborIds),

				isNull(log.removedAt),

				isNotNull(log.movieId),

				args.excludeTmdbIds.length > 0
					? notInArray(log.movieId, args.excludeTmdbIds)
					: undefined,

				contentVisibilityWhere(args.viewerId, log.userId, log.visibility),
			),
		)

		.orderBy(desc(log.watchedAt))

		.limit(SOCIAL_LOG_BATCH_LIMIT);

	for (const row of rows) {
		if (row.log.rating == null) continue;

		if (storedRatingToDisplayTen(row.log.rating) < SOCIAL_MIN_RATING_DISPLAY) {
			continue;
		}

		const tmdbId = row.log.movieId;

		if (tmdbId == null) continue;

		const compat = compatById.get(row.log.userId) ?? 0;

		const socialScore = compat * ratingAffinityWeight(row.log.rating);

		const existing = best.get(tmdbId);

		if (existing != null && socialScore <= existing.socialScore) continue;

		best.set(tmdbId, {
			tmdbId,

			title: row.movie.title,

			posterPath: row.movie.posterPath,

			year: row.movie.year,

			genreIds: row.movie.genreIds ?? [],

			originalLanguage: row.movie.originalLanguage,

			popularity: row.movie.popularity,

			socialScore,
		});
	}

	return best;
}
