import { db, log, movie, profile, tv, user } from "@still/db";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { withinCommunityPeriod } from "./community-period";
import { contentVisibilityWhere } from "./content-visibility";
import { logMediaKey, storedRatingToDisplayTen } from "./sense-taste-overlap";

/** Minimum 0–10 spread between two followed patrons on the same title (ST.5). */
export const FEED_DIVERGENCE_MIN_DELTA = 4;

export type FeedDivergencePatron = {
	userId: string;
	user: { id: string; name: string; image: string | null };
	profile: { handle: string; displayName: string } | null;
	/** Stored `log.rating` (tenths or legacy). */
	rating: number;
	displayRating: number;
	watchedAtMs: number;
};

export type FeedRatingDivergencePayload = {
	mediaKind: "movie" | "tv";
	movieId: number | null;
	tvId: number | null;
	title: string;
	posterPath: string | null;
	lowPatron: FeedDivergencePatron;
	highPatron: FeedDivergencePatron;
	delta: number;
};

type DivergenceLogRow = {
	log: {
		userId: string;
		movieId: number | null;
		tvId: number | null;
		/** Nullable in DB; callers filter with `isNotNull` or skip in the picker. */
		rating: number | null;
		watchedAt: Date;
	};
	movie: {
		tmdbId: number;
		title: string;
		posterPath: string | null;
	} | null;
	tv: { tmdbId: number; title: string; posterPath: string | null } | null;
	user: { id: string; name: string; image: string | null };
	profile: { handle: string; displayName: string } | null;
};

/**
 * Pure picker — latest log per patron per title, then largest spread across patrons.
 */
export function pickFeedRatingDivergence(
	rows: DivergenceLogRow[],
): { at: Date; payload: FeedRatingDivergencePayload } | null {
	const byMedia = new Map<
		string,
		{
			mediaKind: "movie" | "tv";
			movieId: number | null;
			tvId: number | null;
			title: string;
			posterPath: string | null;
			byUser: Map<string, FeedDivergencePatron>;
		}
	>();

	for (const row of rows) {
		const key = logMediaKey(row.log.movieId, row.log.tvId);
		if (!key || row.log.rating == null) continue;

		const displayRating = storedRatingToDisplayTen(row.log.rating);
		const watchedAtMs = row.log.watchedAt.getTime();
		const isMovie = row.log.movieId != null;
		const patron: FeedDivergencePatron = {
			userId: row.log.userId,
			user: row.user,
			profile: row.profile,
			rating: row.log.rating,
			displayRating,
			watchedAtMs,
		};

		let bucket = byMedia.get(key);
		if (!bucket) {
			bucket = {
				mediaKind: isMovie ? "movie" : "tv",
				movieId: row.log.movieId,
				tvId: row.log.tvId,
				title: row.movie?.title ?? row.tv?.title ?? "Untitled",
				posterPath: row.movie?.posterPath ?? row.tv?.posterPath ?? null,
				byUser: new Map(),
			};
			byMedia.set(key, bucket);
		}

		const existing = bucket.byUser.get(row.log.userId);
		if (!existing || watchedAtMs > existing.watchedAtMs) {
			bucket.byUser.set(row.log.userId, patron);
		}
	}

	let best: { at: Date; payload: FeedRatingDivergencePayload } | null = null;

	for (const bucket of byMedia.values()) {
		const patrons = [...bucket.byUser.values()];
		if (patrons.length < 2) continue;

		let low = patrons[0];
		let high = patrons[0];
		for (const patron of patrons) {
			if (patron.displayRating < low.displayRating) low = patron;
			if (patron.displayRating > high.displayRating) high = patron;
		}

		if (low.userId === high.userId) continue;

		const delta =
			Math.round((high.displayRating - low.displayRating) * 10) / 10;
		if (delta < FEED_DIVERGENCE_MIN_DELTA) continue;

		const atMs = Math.max(low.watchedAtMs, high.watchedAtMs);
		const candidate = {
			at: new Date(atMs),
			payload: {
				mediaKind: bucket.mediaKind,
				movieId: bucket.movieId,
				tvId: bucket.tvId,
				title: bucket.title,
				posterPath: bucket.posterPath,
				lowPatron: low,
				highPatron: high,
				delta,
			},
		};

		if (!best || candidate.payload.delta > best.payload.delta) {
			best = candidate;
		}
	}

	return best;
}

/**
 * Loads rated diary rows from followed patrons and returns the strongest disagreement (ST.5).
 */
export async function findFeedRatingDivergence(args: {
	viewerId: string;
	followingUserIds: string[];
	periodStart: Date;
	periodEnd: Date;
}): Promise<{ at: Date; payload: FeedRatingDivergencePayload } | null> {
	if (args.followingUserIds.length < 2) return null;

	const rows = await db
		.select({ log, movie, tv, user, profile })
		.from(log)
		.leftJoin(movie, eq(log.movieId, movie.tmdbId))
		.leftJoin(tv, eq(log.tvId, tv.tmdbId))
		.innerJoin(user, eq(log.userId, user.id))
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(
			and(
				inArray(log.userId, args.followingUserIds),
				isNull(log.removedAt),
				isNotNull(log.rating),
				withinCommunityPeriod(log.watchedAt, args.periodStart, args.periodEnd),
				contentVisibilityWhere(args.viewerId, log.userId, log.visibility),
			),
		)
		.orderBy(desc(log.watchedAt))
		.limit(600);

	return pickFeedRatingDivergence(rows);
}
