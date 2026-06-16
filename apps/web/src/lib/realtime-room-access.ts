import {
	isPatronAppRoomId,
	parseListingMovieRoomId,
	parseListingTvRoomId,
} from "@still/realtime";

/** SSE subscribe permission tier for a realtime room. */
export type RealtimeRoomAccess = "allow" | "read" | "deny";

export type RealtimeRoomAccessDeps = {
	fetchListAccess?: (listId: string) => Promise<RealtimeRoomAccess>;
	fetchReviewAccess?: (reviewId: string) => Promise<RealtimeRoomAccess>;
};

/** Parse `user:{userId}:inbox` private notification rooms. */
export function parseUserInboxRoomId(roomId: string): string | null {
	const match = /^user:([^:]+):inbox$/.exec(roomId);
	return match?.[1] ?? null;
}

/** Parse collaborative list rooms (`list:{listId}`). */
export function parseListRoomId(roomId: string): string | null {
	const match = /^list:([^:]+)$/.exec(roomId);
	return match?.[1] ?? null;
}

/** Parse review broadcast rooms (`review:{reviewId}`). */
export function parseReviewRoomId(roomId: string): string | null {
	const match = /^review:([^:]+)$/.exec(roomId);
	return match?.[1] ?? null;
}

/**
 * Resolve listing + inbox rooms without an API round-trip.
 * Returns `"defer"` when list/review visibility must be checked upstream.
 */
export function resolveStaticRealtimeRoomAccess(
	sessionUserId: string,
	roomId: string,
): RealtimeRoomAccess | "defer" {
	if (
		parseListingMovieRoomId(roomId) != null ||
		parseListingTvRoomId(roomId) != null
	) {
		return "allow";
	}

	if (isPatronAppRoomId(roomId)) {
		return "allow";
	}

	const inboxUserId = parseUserInboxRoomId(roomId);
	if (inboxUserId) {
		return inboxUserId === sessionUserId ? "allow" : "deny";
	}

	if (parseListRoomId(roomId) || parseReviewRoomId(roomId)) {
		return "defer";
	}

	return "deny";
}

/** Map list API visibility to write vs read-only access (lists / legacy collab). */
export function listRealtimeAccessFromViewer(
	viewerCanEdit: boolean | undefined,
): RealtimeRoomAccess {
	return viewerCanEdit ? "allow" : "read";
}

async function defaultFetchListAccess(
	listId: string,
): Promise<RealtimeRoomAccess> {
	const { serverApi } = await import("@/lib/server-api");
	const api = await serverApi();
	const res = await api.api.lists({ id: listId }).get();
	if (res.error || !res.data) return "deny";
	const data = res.data as { viewerCanEdit?: boolean };
	return listRealtimeAccessFromViewer(data.viewerCanEdit);
}

async function defaultFetchReviewAccess(
	reviewId: string,
): Promise<RealtimeRoomAccess> {
	const { serverApi } = await import("@/lib/server-api");
	const api = await serverApi();
	const res = await api.api.reviews({ id: reviewId }).get();
	if (res.error || !res.data) return "deny";
	return "read";
}

/** Compute per-room SSE subscribe permissions for the signed-in patron. */
export async function resolveRealtimeRoomAccess(
	sessionUserId: string,
	roomId: string,
	deps: RealtimeRoomAccessDeps = {},
): Promise<RealtimeRoomAccess> {
	const staticAccess = resolveStaticRealtimeRoomAccess(sessionUserId, roomId);
	if (staticAccess !== "defer") return staticAccess;

	const listId = parseListRoomId(roomId);
	if (listId) {
		return deps.fetchListAccess
			? deps.fetchListAccess(listId)
			: defaultFetchListAccess(listId);
	}

	const reviewId = parseReviewRoomId(roomId);
	if (reviewId) {
		return deps.fetchReviewAccess
			? deps.fetchReviewAccess(reviewId)
			: defaultFetchReviewAccess(reviewId);
	}

	return "deny";
}
