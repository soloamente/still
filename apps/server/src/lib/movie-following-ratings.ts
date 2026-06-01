import { db, follow, log, profile, user } from "@still/db";
import { and, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { contentVisibilityWhere } from "./content-visibility";

/** One followed patron's latest diary signal for a film (rating and/or favorite). */
export type MovieFollowingRatingEntry = {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	/** Stored `log.rating` (tenths or legacy whole). */
	rating: number | null;
	liked: boolean;
	watchedAt: string;
};

type FollowingLogRow = {
	log: {
		userId: string;
		rating: number | null;
		liked: boolean;
		watchedAt: Date;
	};
	user: { id: string; name: string; image: string | null };
	profile: { handle: string; displayName: string } | null;
};

/** Visible avatar chips on film detail — overflow collapses to a “+N more” pill. */
export const MOVIE_FOLLOWING_RATINGS_VISIBLE = 8;

/**
 * Latest rated/favorited log per followed patron for one movie.
 * Excludes the viewer; patrons without `handle` are dropped.
 */
export function pickLatestFollowingRatingsPerPatron(
	rows: FollowingLogRow[],
	viewerId: string,
): MovieFollowingRatingEntry[] {
	const byUser = new Map<string, MovieFollowingRatingEntry>();

	for (const row of rows) {
		if (row.log.userId === viewerId) continue;
		const handle = row.profile?.handle?.trim();
		if (!handle) continue;

		const watchedAtMs = row.log.watchedAt.getTime();
		const existing = byUser.get(row.log.userId);
		if (existing) {
			const existingMs = new Date(existing.watchedAt).getTime();
			if (watchedAtMs <= existingMs) continue;
		}

		byUser.set(row.log.userId, {
			userId: row.log.userId,
			handle,
			displayName: row.profile?.displayName ?? row.user.name,
			image: row.user.image,
			rating: row.log.rating,
			liked: row.log.liked,
			watchedAt: row.log.watchedAt.toISOString(),
		});
	}

	return [...byUser.values()].sort(
		(a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime(),
	);
}

async function fetchFollowingRatingsForTitle(
	viewerId: string,
	titleFilter: ReturnType<typeof eq>,
): Promise<{ entries: MovieFollowingRatingEntry[]; moreCount: number }> {
	const following = await db
		.select({ id: follow.followingId })
		.from(follow)
		.where(eq(follow.followerId, viewerId));

	const followingIds = following.map((f) => f.id);
	if (followingIds.length === 0) {
		return { entries: [], moreCount: 0 };
	}

	const rows = await db
		.select({ log, user, profile })
		.from(log)
		.innerJoin(user, eq(log.userId, user.id))
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(
			and(
				titleFilter,
				inArray(log.userId, followingIds),
				or(isNotNull(log.rating), eq(log.liked, true)),
				contentVisibilityWhere(viewerId, log.userId, log.visibility),
			),
		)
		.orderBy(desc(log.watchedAt))
		.limit(400);

	const deduped = pickLatestFollowingRatingsPerPatron(rows, viewerId);
	const visible = deduped.slice(0, MOVIE_FOLLOWING_RATINGS_VISIBLE);
	const moreCount = Math.max(0, deduped.length - visible.length);

	return { entries: visible, moreCount };
}

/** Followed patrons who rated or favorited this movie — film detail community. */
export function fetchFollowingRatingsForMovie(
	viewerId: string,
	movieId: number,
): Promise<{ entries: MovieFollowingRatingEntry[]; moreCount: number }> {
	return fetchFollowingRatingsForTitle(viewerId, eq(log.movieId, movieId));
}

/** Followed patrons who rated or favorited this series — TV detail community. */
export function fetchFollowingRatingsForTv(
	viewerId: string,
	tvId: number,
): Promise<{ entries: MovieFollowingRatingEntry[]; moreCount: number }> {
	return fetchFollowingRatingsForTitle(viewerId, eq(log.tvId, tvId));
}
