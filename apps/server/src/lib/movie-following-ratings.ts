import type { StaffRole } from "@still/auth/permissions";
import { db, follow, log, profile, user } from "@still/db";
import type { PlanTierId } from "@still/plans";
import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { contentVisibilityWhere } from "./content-visibility";
import type { DiaryMetalTier } from "./diary-metal-tier";
import {
	fetchPatronAvatarBadgeMaps,
	patronAvatarBadgeFields,
} from "./patron-avatar-badge";
import { readAvatarIsAnimatedPref } from "./profile-media";
import { resolveTvTitleScore } from "./tv-title-score";

/** One followed patron's latest diary signal for a film (rating and/or favorite). */
export type MovieFollowingRatingEntry = {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
	planTier: PlanTierId;
	staffRole: StaffRole | null;
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
		logScope?: string | null;
		seasonNumber?: number | null;
	};
	user: { id: string; name: string; image: string | null };
	profile: {
		handle: string;
		displayName: string;
		preferences?: Record<string, unknown> | null;
	} | null;
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
	badgeMaps: Awaited<ReturnType<typeof fetchPatronAvatarBadgeMaps>> = {
		logCounts: new Map(),
		planTiers: new Map(),
		staffRoles: new Map(),
	},
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
			avatarIsAnimated: readAvatarIsAnimatedPref(row.profile?.preferences),
			...patronAvatarBadgeFields(row.log.userId, badgeMaps),
			rating: row.log.rating,
			liked: row.log.liked,
			watchedAt: row.log.watchedAt.toISOString(),
		});
	}

	return [...byUser.values()].sort(
		(a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime(),
	);
}

/**
 * TV following chips — resolve title score across scopes; liked if any log is favorited.
 */
export function pickResolvedFollowingRatingsForTv(
	rows: FollowingLogRow[],
	viewerId: string,
	badgeMaps: Awaited<ReturnType<typeof fetchPatronAvatarBadgeMaps>> = {
		logCounts: new Map(),
		planTiers: new Map(),
		staffRoles: new Map(),
	},
): MovieFollowingRatingEntry[] {
	type Acc = {
		rows: FollowingLogRow[];
		handle: string;
		displayName: string;
		image: string | null;
		preferences: Record<string, unknown> | null | undefined;
	};
	const byUser = new Map<string, Acc>();

	for (const row of rows) {
		if (row.log.userId === viewerId) continue;
		const handle = row.profile?.handle?.trim();
		if (!handle) continue;

		const existing = byUser.get(row.log.userId);
		if (existing) {
			existing.rows.push(row);
			continue;
		}
		byUser.set(row.log.userId, {
			rows: [row],
			handle,
			displayName: row.profile?.displayName ?? row.user.name,
			image: row.user.image,
			preferences: row.profile?.preferences,
		});
	}

	const entries: MovieFollowingRatingEntry[] = [];
	for (const [userId, acc] of byUser) {
		let liked = false;
		let maxWatchedAt = 0;
		for (const row of acc.rows) {
			if (row.log.liked) liked = true;
			const ms = row.log.watchedAt.getTime();
			if (ms > maxWatchedAt) maxWatchedAt = ms;
		}

		entries.push({
			userId,
			handle: acc.handle,
			displayName: acc.displayName,
			image: acc.image,
			avatarIsAnimated: readAvatarIsAnimatedPref(acc.preferences),
			...patronAvatarBadgeFields(userId, badgeMaps),
			rating: resolveTvTitleScore(
				acc.rows.map((row) => ({
					logScope: row.log.logScope,
					seasonNumber: row.log.seasonNumber,
					rating: row.log.rating,
				})),
			),
			liked,
			watchedAt: new Date(maxWatchedAt).toISOString(),
		});
	}

	return entries.sort(
		(a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime(),
	);
}

async function fetchFollowingRatingsForTitle(
	viewerId: string,
	titleFilter: ReturnType<typeof eq>,
	mode: "movie" | "tv",
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
				isNull(log.removedAt),
				or(isNotNull(log.rating), eq(log.liked, true)),
				contentVisibilityWhere(viewerId, log.userId, log.visibility),
			),
		)
		.orderBy(desc(log.watchedAt))
		.limit(400);

	const userIds = rows.map((row) => row.log.userId);
	const badgeMaps = await fetchPatronAvatarBadgeMaps(userIds);
	const deduped =
		mode === "tv"
			? pickResolvedFollowingRatingsForTv(rows, viewerId, badgeMaps)
			: pickLatestFollowingRatingsPerPatron(rows, viewerId, badgeMaps);
	const visible = deduped.slice(0, MOVIE_FOLLOWING_RATINGS_VISIBLE);
	const moreCount = Math.max(0, deduped.length - visible.length);

	return { entries: visible, moreCount };
}

/** Followed patrons who rated or favorited this movie — film detail community. */
export function fetchFollowingRatingsForMovie(
	viewerId: string,
	movieId: number,
): Promise<{ entries: MovieFollowingRatingEntry[]; moreCount: number }> {
	return fetchFollowingRatingsForTitle(
		viewerId,
		eq(log.movieId, movieId),
		"movie",
	);
}

/** Followed patrons who rated or favorited this series — TV detail community. */
export function fetchFollowingRatingsForTv(
	viewerId: string,
	tvId: number,
): Promise<{ entries: MovieFollowingRatingEntry[]; moreCount: number }> {
	return fetchFollowingRatingsForTitle(viewerId, eq(log.tvId, tvId), "tv");
}
