import { db, follow, profile, user } from "@still/db";
import { parseListingMovieRoomId, parseListingTvRoomId } from "@still/realtime";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";

import {
	type DiaryMetalTier,
	fetchDiaryLogCountsForUserIds,
	resolveDiaryMetalTier,
} from "./diary-metal-tier";
import {
	clearActivityStateForUser,
	type PatronActivityState,
	readActivityStatesForUserIds,
	writeActivityStateForUser,
} from "./presence-activity";
import {
	PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC,
	readAvatarIsAnimatedPref,
	readProfilePresenceVisibilityPref,
} from "./profile-media";

/** Drop heartbeats older than this from occupancy counts. */
export const LISTING_PRESENCE_STALE_MS = 45_000;

/** Redis key TTL — same 24h retention pattern as stream keys. */
export const LISTING_PRESENCE_KEY_TTL_SEC = 86_400;

/** Max mutual patrons returned for `+N` overflow math (UI shows first 3). */
export const LISTING_PRESENCE_MUTUAL_FETCH_LIMIT = 8;

/** Minimal Redis ZSET surface used by listing presence helpers. */
export type ListingPresenceRedis = {
	zadd: (
		key: string,
		entry: { score: number; member: string },
	) => Promise<unknown>;
	zremrangebyscore: (key: string, min: number, max: number) => Promise<unknown>;
	zrem: (key: string, member: string) => Promise<unknown>;
	zcard: (key: string) => Promise<number>;
	zrange: (key: string, start: number, stop: number) => Promise<string[]>;
	expire: (key: string, seconds: number) => Promise<unknown>;
	hset?: (key: string, field: string, value: string) => Promise<unknown>;
	hget?: (key: string, field: string) => Promise<string | null>;
	hdel?: (key: string, field: string) => Promise<unknown>;
};

export type ListingPresenceTouchResult = {
	occupantCount: number;
	changed: boolean;
};

/** Public-profile patron chip on title detail presence row. */
export type ListingPresenceViewingPatron = {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	avatarIsAnimated: boolean;
	diaryMetalTier: DiaryMetalTier | null;
	presenceState: PatronActivityState;
};

export type ListingPresenceSnapshot = {
	viewerCount: number;
	viewingPatrons: ListingPresenceViewingPatron[];
};

type MutualPatronRow = {
	userId: string;
	handle: string | null;
	displayName: string | null;
	name: string | null;
	image: string | null;
	preferences: Record<string, unknown> | null | undefined;
	isMutualWithViewer: boolean;
};

/** Redis ZSET key for ephemeral patrons in a logical listing room. */
export function presenceRedisKey(roomId: string): string {
	return `sense:presence:${roomId}`;
}

/** True for `listing:movie:{id}` and `listing:tv:{id}` room ids. */
export function isListingPresenceRoom(roomId: string): boolean {
	return (
		parseListingMovieRoomId(roomId) != null ||
		parseListingTvRoomId(roomId) != null
	);
}

/** Remove stale heartbeat members before counting or touching. */
export async function pruneStaleListingPresence(
	redis: ListingPresenceRedis,
	roomId: string,
	nowMs: number = Date.now(),
): Promise<void> {
	const staleBefore = nowMs - LISTING_PRESENCE_STALE_MS;
	await redis.zremrangebyscore(presenceRedisKey(roomId), 0, staleBefore);
}

/** Active patron user ids in a listing room after stale prune. */
export async function activeListingPresenceUserIds(
	redis: ListingPresenceRedis,
	roomId: string,
	nowMs: number = Date.now(),
): Promise<string[]> {
	await pruneStaleListingPresence(redis, roomId, nowMs);
	return redis.zrange(presenceRedisKey(roomId), 0, -1);
}

/** Total patrons currently in the room (includes caller). */
export async function countListingPresenceOccupants(
	redis: ListingPresenceRedis,
	roomId: string,
	nowMs: number = Date.now(),
): Promise<number> {
	await pruneStaleListingPresence(redis, roomId, nowMs);
	return redis.zcard(presenceRedisKey(roomId));
}

/** Others in room excluding the viewer — matches GET `viewerCount`. */
export function viewerCountExcludingSelf(
	occupantCount: number,
	selfUserId: string,
	activeUserIds: string[],
): number {
	if (!activeUserIds.includes(selfUserId)) {
		return occupantCount;
	}
	return Math.max(0, occupantCount - 1);
}

function hasPresenceActivityRedis(
	redis: ListingPresenceRedis,
): redis is ListingPresenceRedis & {
	hset: (key: string, field: string, value: string) => Promise<unknown>;
	hget: (key: string, field: string) => Promise<string | null>;
	hdel: (key: string, field: string) => Promise<unknown>;
} {
	return (
		typeof redis.hset === "function" &&
		typeof redis.hget === "function" &&
		typeof redis.hdel === "function"
	);
}

/** Record a heartbeat for the patron; returns whether occupancy changed. */
export async function touchListingPresence(
	redis: ListingPresenceRedis,
	roomId: string,
	userId: string,
	nowMs: number = Date.now(),
	activityState: PatronActivityState = "active",
): Promise<ListingPresenceTouchResult> {
	const key = presenceRedisKey(roomId);
	await pruneStaleListingPresence(redis, roomId, nowMs);
	const beforeCount = await redis.zcard(key);

	await redis.zadd(key, { score: nowMs, member: userId });
	await redis.expire(key, LISTING_PRESENCE_KEY_TTL_SEC);
	if (hasPresenceActivityRedis(redis)) {
		await writeActivityStateForUser(redis, userId, activityState);
	}

	const afterCount = await redis.zcard(key);
	return {
		occupantCount: afterCount,
		changed: afterCount !== beforeCount,
	};
}

/** Remove patron on tab close; returns whether occupancy changed. */
export async function leaveListingPresence(
	redis: ListingPresenceRedis,
	roomId: string,
	userId: string,
	nowMs: number = Date.now(),
): Promise<ListingPresenceTouchResult> {
	const key = presenceRedisKey(roomId);
	await pruneStaleListingPresence(redis, roomId, nowMs);
	const beforeCount = await redis.zcard(key);

	await redis.zrem(key, userId);
	if (hasPresenceActivityRedis(redis)) {
		await clearActivityStateForUser(redis, userId);
	}

	const afterCount = await redis.zcard(key);
	return {
		occupantCount: afterCount,
		changed: beforeCount !== afterCount,
	};
}

/** Map joined profile rows to viewing patron chips (pure — unit tested). */
export function pickListingPresenceViewingPatrons(
	rows: MutualPatronRow[],
	logCounts: ReadonlyMap<string, number> = new Map(),
	limit: number = LISTING_PRESENCE_MUTUAL_FETCH_LIMIT,
	activityByUserId: ReadonlyMap<string, PatronActivityState> = new Map(),
): ListingPresenceViewingPatron[] {
	const patrons: ListingPresenceViewingPatron[] = [];

	for (const row of rows) {
		const handle = row.handle?.trim();
		if (!handle) continue;
		const presenceVisibility = readProfilePresenceVisibilityPref(
			row.preferences,
		);
		const visibleToViewer =
			presenceVisibility === PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC ||
			row.isMutualWithViewer;
		if (!visibleToViewer) continue;

		patrons.push({
			userId: row.userId,
			handle,
			displayName: row.displayName?.trim() || row.name?.trim() || handle,
			image: row.image,
			avatarIsAnimated: readAvatarIsAnimatedPref(row.preferences),
			diaryMetalTier: resolveDiaryMetalTier(logCounts.get(row.userId) ?? 0),
			presenceState: activityByUserId.get(row.userId) ?? "active",
		});
		if (patrons.length >= limit) break;
	}

	return patrons;
}

/**
 * Public-profile patrons currently in the listing room (excludes viewer).
 * Private profiles stay count-only on the client.
 */
export async function fetchViewingPatronsInRoom(
	viewerId: string,
	activeUserIds: string[],
	redis: ListingPresenceRedis | null = null,
): Promise<ListingPresenceViewingPatron[]> {
	const candidateIds = activeUserIds.filter((id) => id !== viewerId);
	if (candidateIds.length === 0) return [];
	const mutualRows = await db
		.select({ userId: follow.followingId })
		.from(follow)
		.where(
			and(
				eq(follow.followerId, viewerId),
				eq(follow.isMutual, true),
				inArray(follow.followingId, candidateIds),
			),
		);
	const mutualIds = new Set(mutualRows.map((row) => row.userId));

	const rows = await db
		.select({
			userId: profile.userId,
			handle: profile.handle,
			displayName: profile.displayName,
			name: user.name,
			image: user.image,
			preferences: profile.preferences,
		})
		.from(profile)
		.innerJoin(user, eq(profile.userId, user.id))
		.where(
			and(
				inArray(profile.userId, candidateIds),
				eq(profile.isPrivate, false),
				isNotNull(profile.handle),
			),
		)
		.orderBy(asc(profile.displayName), asc(profile.handle))
		.limit(LISTING_PRESENCE_MUTUAL_FETCH_LIMIT);

	const logCounts = await fetchDiaryLogCountsForUserIds(
		rows.map((row) => row.userId),
	);
	const activityByUserId =
		redis && typeof redis.hget === "function"
			? await readActivityStatesForUserIds(redis, candidateIds)
			: new Map<string, PatronActivityState>();
	return pickListingPresenceViewingPatrons(
		rows.map((row) => ({
			...row,
			isMutualWithViewer: mutualIds.has(row.userId),
		})),
		logCounts,
		LISTING_PRESENCE_MUTUAL_FETCH_LIMIT,
		activityByUserId,
	);
}

/** Personalized presence snapshot for the signed-in viewer on a title detail page. */
export async function getListingPresenceSnapshot(
	viewerId: string,
	roomId: string,
	redis: ListingPresenceRedis | null,
	nowMs: number = Date.now(),
): Promise<ListingPresenceSnapshot> {
	if (!redis || !isListingPresenceRoom(roomId)) {
		return { viewerCount: 0, viewingPatrons: [] };
	}

	const activeUserIds = await activeListingPresenceUserIds(
		redis,
		roomId,
		nowMs,
	);
	const viewerCount = viewerCountExcludingSelf(
		activeUserIds.length,
		viewerId,
		activeUserIds,
	);
	const viewingPatrons = await fetchViewingPatronsInRoom(
		viewerId,
		activeUserIds,
		redis,
	);

	return { viewerCount, viewingPatrons };
}
