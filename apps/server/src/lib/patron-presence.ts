import { db, profile } from "@still/db";
import { patronAppRoomId } from "@still/realtime";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import {
	activeListingPresenceUserIds,
	type ListingPresenceRedis,
	leaveListingPresence,
	touchListingPresence,
} from "./listing-presence";
import { fetchMutualFollowingIds } from "./mutual-follow-cache";
import {
	type PatronActivityState,
	readActivityStatesForUserIds,
} from "./presence-activity";
import {
	PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC,
	readProfilePresenceVisibilityPref,
} from "./profile-media";

/** Max handles per batch online-status lookup. */
export const PATRON_ONLINE_HANDLE_BATCH_LIMIT = 64;

export { patronAppRoomId };

type PatronPresenceRow = {
	userId: string;
	handle: string | null;
	preferences: Record<string, unknown> | null | undefined;
	isMutualWithViewer: boolean;
};

export type VisiblePatronPresence = {
	handle: string;
	state: PatronActivityState;
};

/**
 * Patrons the viewer may see as online — respects presence visibility prefs,
 * excludes the viewer, and attaches active/away state from Redis.
 */
export function pickVisiblePresenceForViewer(
	viewerId: string,
	rows: PatronPresenceRow[],
	activeUserIds: ReadonlySet<string>,
	activityByUserId: ReadonlyMap<string, PatronActivityState> = new Map(),
): VisiblePatronPresence[] {
	const presence: VisiblePatronPresence[] = [];

	for (const row of rows) {
		if (row.userId === viewerId) continue;
		if (!activeUserIds.has(row.userId)) continue;

		const handle = row.handle?.trim();
		if (!handle) continue;

		const presenceVisibility = readProfilePresenceVisibilityPref(
			row.preferences,
		);
		const visibleToViewer =
			presenceVisibility === PROFILE_PRIVACY_PRESENCE_VISIBILITY_PUBLIC ||
			row.isMutualWithViewer;
		if (!visibleToViewer) continue;

		presence.push({
			handle: handle.toLowerCase(),
			state: activityByUserId.get(row.userId) ?? "active",
		});
	}

	return presence;
}

/**
 * Handles the viewer may see as online now — respects presence visibility prefs
 * and excludes the viewer's own handle.
 */
export function pickVisibleOnlineHandles(
	viewerId: string,
	rows: PatronPresenceRow[],
	activeUserIds: ReadonlySet<string>,
): string[] {
	return pickVisiblePresenceForViewer(viewerId, rows, activeUserIds).map(
		(row) => row.handle,
	);
}

/** Normalize and cap client-supplied handle batches. */
export function normalizePatronOnlineHandleBatch(handles: string[]): string[] {
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const raw of handles) {
		const handle = raw.trim().toLowerCase();
		if (!handle || seen.has(handle)) continue;
		seen.add(handle);
		normalized.push(handle);
		if (normalized.length >= PATRON_ONLINE_HANDLE_BATCH_LIMIT) break;
	}

	return normalized;
}

/** Heartbeat for signed-in app activity (any `(app)` route). */
export async function touchPatronAppPresence(
	redis: ListingPresenceRedis,
	userId: string,
	nowMs: number = Date.now(),
	activityState: PatronActivityState = "active",
) {
	return touchListingPresence(
		redis,
		patronAppRoomId(),
		userId,
		nowMs,
		activityState,
	);
}

/** Remove patron from the global online set on tab close. */
export async function leavePatronAppPresence(
	redis: ListingPresenceRedis,
	userId: string,
	nowMs: number = Date.now(),
) {
	return leaveListingPresence(redis, patronAppRoomId(), userId, nowMs);
}

/**
 * Batch resolve which requested handles are online for the viewer with state.
 */
export async function resolveVisiblePresenceForViewer(
	viewerId: string,
	requestedHandles: string[],
	redis: ListingPresenceRedis | null,
	nowMs: number = Date.now(),
): Promise<VisiblePatronPresence[]> {
	const handles = normalizePatronOnlineHandleBatch(requestedHandles);
	if (handles.length === 0 || !redis) return [];

	const activeUserIds = new Set(
		await activeListingPresenceUserIds(redis, patronAppRoomId(), nowMs),
	);
	if (activeUserIds.size === 0) return [];

	const rows = await db
		.select({
			userId: profile.userId,
			handle: profile.handle,
			preferences: profile.preferences,
		})
		.from(profile)
		.where(
			and(
				inArray(profile.handle, handles),
				eq(profile.isPrivate, false),
				isNotNull(profile.handle),
			),
		);

	const candidateIds = rows
		.map((row) => row.userId)
		.filter((id) => activeUserIds.has(id));
	if (candidateIds.length === 0) return [];

	const mutualAll = await fetchMutualFollowingIds(viewerId);
	const mutualIds = new Set(
		candidateIds.filter((id) => mutualAll.includes(id)),
	);

	const activityByUserId =
		typeof redis.hget === "function"
			? await readActivityStatesForUserIds({ hget: redis.hget }, candidateIds)
			: new Map<string, PatronActivityState>();

	return pickVisiblePresenceForViewer(
		viewerId,
		rows.map((row) => ({
			...row,
			isMutualWithViewer: mutualIds.has(row.userId),
		})),
		activeUserIds,
		activityByUserId,
	);
}

/**
 * Resolve visible presence using DO occupancy entries instead of Upstash ZSET.
 * Same DB joins as resolveVisiblePresenceForViewer, but activeUserIds come from DO.
 */
export async function resolveVisiblePresenceFromOccupancy(
	viewerId: string,
	requestedHandles: string[],
	entries: { userId: string; activityState: PatronActivityState }[],
): Promise<VisiblePatronPresence[]> {
	const handles = normalizePatronOnlineHandleBatch(requestedHandles);
	if (handles.length === 0 || entries.length === 0) return [];

	const activeUserIds = new Set(entries.map((e) => e.userId));
	const activityByUserId = new Map(
		entries.map((e) => [e.userId, e.activityState] as const),
	);

	const rows = await db
		.select({
			userId: profile.userId,
			handle: profile.handle,
			preferences: profile.preferences,
		})
		.from(profile)
		.where(
			and(
				inArray(profile.handle, handles),
				eq(profile.isPrivate, false),
				isNotNull(profile.handle),
			),
		);

	const candidateIds = rows
		.map((row) => row.userId)
		.filter((id) => activeUserIds.has(id));
	if (candidateIds.length === 0) return [];

	const mutualAll = await fetchMutualFollowingIds(viewerId);
	const mutualIds = new Set(
		candidateIds.filter((id) => mutualAll.includes(id)),
	);

	return pickVisiblePresenceForViewer(
		viewerId,
		rows.map((row) => ({
			...row,
			isMutualWithViewer: mutualIds.has(row.userId),
		})),
		activeUserIds,
		activityByUserId,
	);
}

/**
 * Batch resolve which requested handles are online now for the viewer.
 * Returns lowercase handles the viewer is allowed to see as online.
 */
export async function resolveVisibleOnlineHandlesForViewer(
	viewerId: string,
	requestedHandles: string[],
	redis: ListingPresenceRedis | null,
	nowMs: number = Date.now(),
): Promise<string[]> {
	const presence = await resolveVisiblePresenceForViewer(
		viewerId,
		requestedHandles,
		redis,
		nowMs,
	);
	return presence.map((row) => row.handle);
}
