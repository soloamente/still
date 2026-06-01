import { db, follow, log, profile, user } from "@still/db";
import { and, desc, eq, isNotNull, or } from "drizzle-orm";

/** Max friend chips returned; UI renders a `+N more` past this. */
export const FRIENDS_RATINGS_LIMIT = 12;

export type FriendRatingRow = {
	userId: string;
	handle: string | null;
	displayName: string | null;
	avatarUrl: string | null;
	rating: number | null;
	liked: boolean;
	watchedAt: string;
};

export type FriendsRatingsResult = {
	rows: FriendRatingRow[];
	/** Distinct friends with a qualifying log — `total - rows.length` powers `+N more`. */
	total: number;
};

/** Raw log+friend row before dedupe/ranking (one per log, friends may repeat). */
export type RawFriendLog = {
	userId: string;
	handle: string | null;
	displayName: string | null;
	name: string | null;
	avatarUrl: string | null;
	rating: number | null;
	liked: boolean;
	watchedAt: Date | string;
};

const EMPTY: FriendsRatingsResult = { rows: [], total: 0 };

/**
 * Collapses raw friend logs to one entry per friend (highest-rated log wins),
 * sorts rated friends first (by rating, then recency), and caps to the chip
 * limit while reporting the full distinct-friend `total`. Pure — unit tested.
 */
export function rankFriendsRatings(raw: RawFriendLog[]): FriendsRatingsResult {
	const byUser = new Map<string, FriendRatingRow>();
	for (const r of raw) {
		const candidate: FriendRatingRow = {
			userId: r.userId,
			handle: r.handle,
			displayName: r.displayName ?? r.name ?? r.handle,
			avatarUrl: r.avatarUrl,
			rating: r.rating,
			liked: r.liked,
			watchedAt:
				r.watchedAt instanceof Date
					? r.watchedAt.toISOString()
					: String(r.watchedAt),
		};
		const existing = byUser.get(r.userId);
		if (!existing || (candidate.rating ?? -1) > (existing.rating ?? -1)) {
			byUser.set(r.userId, candidate);
		}
	}

	const all = [...byUser.values()].sort((a, b) => {
		const ar = a.rating ?? -1;
		const br = b.rating ?? -1;
		if (ar !== br) return br - ar;
		return new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime();
	});

	return { rows: all.slice(0, FRIENDS_RATINGS_LIMIT), total: all.length };
}

/**
 * Ratings for a title from the viewer's **mutual-follow friends** (`follow.isMutual`).
 * Only logs that carry signal (a rating, or liked) are included. One row per
 * friend — their highest-rated log for the title wins. Rated friends sort first.
 */
export async function fetchFriendsRatings(opts: {
	viewerId: string;
	movieId?: number;
	tvId?: number;
}): Promise<FriendsRatingsResult> {
	const titleMatch =
		opts.movieId != null
			? eq(log.movieId, opts.movieId)
			: opts.tvId != null
				? eq(log.tvId, opts.tvId)
				: null;
	if (!titleMatch) return EMPTY;

	const raw = await db
		.select({
			userId: log.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			name: user.name,
			avatarUrl: user.image,
			rating: log.rating,
			liked: log.liked,
			watchedAt: log.watchedAt,
		})
		.from(follow)
		.innerJoin(log, eq(log.userId, follow.followingId))
		.leftJoin(user, eq(user.id, follow.followingId))
		.leftJoin(profile, eq(profile.userId, follow.followingId))
		.where(
			and(
				eq(follow.followerId, opts.viewerId),
				eq(follow.isMutual, true),
				titleMatch,
				or(isNotNull(log.rating), eq(log.liked, true)),
			),
		)
		.orderBy(desc(log.watchedAt));

	return rankFriendsRatings(raw);
}
