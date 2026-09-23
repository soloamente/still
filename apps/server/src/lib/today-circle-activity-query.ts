import {
	block,
	db,
	follow,
	log,
	movie,
	profile,
	review,
	tv,
	user,
} from "@still/db";
import { and, desc, eq, gte, isNull, notInArray, or } from "drizzle-orm";

import { joinedTitleItemNotAdultSql } from "./adult-content-sql";
import { getShowAdultContentForUser } from "./adult-content-user-pref";
import { contentVisibilityWhere } from "./content-visibility";
import {
	fetchPlanTiersForUserIds,
	planTierForUserId,
} from "./patron-plan-tier";
import {
	fetchStaffRolesForUserIds,
	staffRoleForUserId,
} from "./patron-staff-role";
import {
	buildTodayCirclePayload,
	type TodayCirclePayload,
} from "./today-circle-activity";

/** "Recent" for a Today card — older followee logs show the invite instead. */
const CIRCLE_WINDOW_MS = 30 * 86_400_000;

/** Blocks in either direction hide the other patron from the viewer. */
async function blockedUserIdsForViewer(viewerId: string): Promise<string[]> {
	const rows = await db
		.select({ blockerId: block.blockerId, blockedId: block.blockedId })
		.from(block)
		.where(or(eq(block.blockerId, viewerId), eq(block.blockedId, viewerId)));
	return rows.map((r) =>
		r.blockerId === viewerId ? r.blockedId : r.blockerId,
	);
}

/**
 * Most recent diary log (by logged time) from someone the viewer follows that the
 * viewer may see — log + linked review visibility, adult pref, blocks, bans.
 */
export async function fetchTodayCircleActivity(
	viewerId: string,
	now = new Date(),
): Promise<TodayCirclePayload> {
	const [showAdultContent, blockedIds] = await Promise.all([
		getShowAdultContentForUser(viewerId),
		blockedUserIdsForViewer(viewerId),
	]);

	const [row] = await db
		.select({
			logId: log.id,
			actorUserId: log.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			actorImage: user.image,
			rating: log.rating,
			movieId: log.movieId,
			tvId: log.tvId,
			movieTitle: movie.title,
			moviePosterPath: movie.posterPath,
			tvTitle: tv.title,
			tvPosterPath: tv.posterPath,
			reviewBody: review.body,
			reviewContainsSpoilers: review.containsSpoilers,
		})
		.from(log)
		.innerJoin(
			follow,
			and(eq(follow.followingId, log.userId), eq(follow.followerId, viewerId)),
		)
		.innerJoin(user, eq(user.id, log.userId))
		.innerJoin(profile, eq(profile.userId, log.userId))
		.leftJoin(movie, eq(movie.tmdbId, log.movieId))
		.leftJoin(tv, eq(tv.tmdbId, log.tvId))
		.leftJoin(
			review,
			and(
				eq(review.logId, log.id),
				isNull(review.removedAt),
				contentVisibilityWhere(viewerId, review.userId, review.visibility),
			),
		)
		.where(
			and(
				isNull(log.removedAt),
				eq(user.banned, false),
				gte(log.createdAt, new Date(now.getTime() - CIRCLE_WINDOW_MS)),
				contentVisibilityWhere(viewerId, log.userId, log.visibility),
				blockedIds.length > 0 ? notInArray(log.userId, blockedIds) : undefined,
				joinedTitleItemNotAdultSql(showAdultContent, {
					movieId: log.movieId,
					tvId: log.tvId,
				}),
			),
		)
		.orderBy(desc(log.createdAt), desc(log.id))
		.limit(1);

	if (!row) return buildTodayCirclePayload(null, null);

	const [planTiers, staffRoles] = await Promise.all([
		fetchPlanTiersForUserIds([row.actorUserId]),
		fetchStaffRolesForUserIds([row.actorUserId]),
	]);
	return buildTodayCirclePayload(row, {
		planTier: planTierForUserId(row.actorUserId, planTiers),
		staffRole: staffRoleForUserId(row.actorUserId, staffRoles),
	});
}
