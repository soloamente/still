import { db, follow, profile } from "@still/db";
import { patronAppRoomId } from "@still/realtime";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import {
	activeListingPresenceUserIds,
	type ListingPresenceRedis,
	leaveListingPresence,
	touchListingPresence,
} from "./listing-presence";
import type { PatronActivityState } from "./presence-activity";
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

/**
 * Handles the viewer may see as online now — respects presence visibility prefs
 * and excludes the viewer's own handle.
 */
export function pickVisibleOnlineHandles(
	viewerId: string,
	rows: PatronPresenceRow[],
	activeUserIds: ReadonlySet<string>,
): string[] {
	const handles: string[] = [];

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

		handles.push(handle.toLowerCase());
	}

	return handles;
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
 * Batch resolve which requested handles are online now for the viewer.
 * Returns lowercase handles the viewer is allowed to see as online.
 */
export async function resolveVisibleOnlineHandlesForViewer(
	viewerId: string,
	requestedHandles: string[],
	redis: ListingPresenceRedis | null,
	nowMs: number = Date.now(),
): Promise<string[]> {
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

	return pickVisibleOnlineHandles(
		viewerId,
		rows.map((row) => ({
			...row,
			isMutualWithViewer: mutualIds.has(row.userId),
		})),
		activeUserIds,
	);
}
