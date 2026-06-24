/** Listing channel id — movie/TV detail presence heartbeats (Phase B). */
export function listingMovieRoomId(tmdbId: number | string): string {
	return `listing:movie:${tmdbId}`;
}

/** Listing channel id — movie/TV detail presence heartbeats (Phase B). */
export function listingTvRoomId(tmdbId: number | string): string {
	return `listing:tv:${tmdbId}`;
}

/** Parse a movie listing room id back to TMDb id, or null when malformed. */
export function parseListingMovieRoomId(roomId: string): number | null {
	const match = /^listing:movie:(\d+)$/.exec(roomId);
	return match ? Number(match[1]) : null;
}

/** Parse a TV listing room id back to TMDb id, or null when malformed. */
export function parseListingTvRoomId(roomId: string): number | null {
	const match = /^listing:tv:(\d+)$/.exec(roomId);
	return match ? Number(match[1]) : null;
}

/** True for `listing:movie:{id}` and `listing:tv:{id}` room ids. */
export function isListingRoomId(roomId: string): boolean {
	return (
		parseListingMovieRoomId(roomId) != null ||
		parseListingTvRoomId(roomId) != null
	);
}

/** List channel id (reserved for future collab; reorder is REST-only today). */
export function listRoomId(listId: string): string {
	return `list:${listId}`;
}

/** Parse a list room id back to the list id, or null when malformed. */
export function parseListRoomId(roomId: string): string | null {
	const match = /^list:(.+)$/.exec(roomId);
	return match?.[1] ?? null;
}

/** Review reader broadcast channel for live comments and reactions. */
export function reviewRoomId(reviewId: string): string {
	return `review:${reviewId}`;
}

/** Parse a review room id back to the review id, or null when malformed. */
export function parseReviewRoomId(roomId: string): string | null {
	const match = /^review:(.+)$/.exec(roomId);
	return match?.[1] ?? null;
}

/** App-wide patron heartbeat — signed-in activity anywhere in `(app)`. */
export const PATRON_APP_PRESENCE_ROOM = "patron:app";

/** App-wide patron heartbeat room id. */
export function patronAppRoomId(): string {
	return PATRON_APP_PRESENCE_ROOM;
}

/** True for the global patron presence room. */
export function isPatronAppRoomId(roomId: string): boolean {
	return roomId === PATRON_APP_PRESENCE_ROOM;
}

/** True for listing and patron-app presence rooms. */
export function isPresenceRoomId(roomId: string): boolean {
	return isListingRoomId(roomId) || roomId === PATRON_APP_PRESENCE_ROOM;
}

/** Private inbox room for notification push events. */
export function userInboxRoomId(userId: string): string {
	return `user:${userId}:inbox`;
}

/** Parse a user inbox room id back to the user id, or null when malformed. */
export function parseUserInboxRoomId(roomId: string): string | null {
	const match = /^user:(.+):inbox$/.exec(roomId);
	return match?.[1] ?? null;
}

/** Chat thread delivery room (Wave 2). */
export function chatRoomId(threadId: string): string {
	return `chat:${threadId}`;
}

/** Parse a chat room id back to the thread id, or null when malformed. */
export function parseChatRoomId(roomId: string): string | null {
	const match = /^chat:(.+)$/.exec(roomId);
	return match?.[1] ?? null;
}

/** Staff plans collaboration room — presence for /staff/plans. */
export const STAFF_PLANS_ROOM = "staff:plans";

export function staffPlansRoomId(): string {
	return STAFF_PLANS_ROOM;
}

export type RoomAuthTier = "allow" | "self" | "dynamic" | "deny";

/**
 * Authorization tier for a room id. Used by both the Cloudflare Worker and
 * the server authorize endpoint to gate WS subscriptions.
 *
 * - allow:   any signed-in user (listing presence, patron:app)
 * - self:    only the ownerUserId (inbox)
 * - dynamic: requires a DB check (review, list, chat)
 * - deny:    not accessible via WebSocket
 */
export function classifyRoom(roomId: string): {
	tier: RoomAuthTier;
	ownerUserId?: string;
} {
	if (isListingRoomId(roomId)) return { tier: "allow" };
	if (roomId === PATRON_APP_PRESENCE_ROOM) return { tier: "allow" };

	const inboxUserId = parseUserInboxRoomId(roomId);
	if (inboxUserId) return { tier: "self", ownerUserId: inboxUserId };

	if (parseReviewRoomId(roomId) !== null) return { tier: "dynamic" };
	if (parseListRoomId(roomId) !== null) return { tier: "dynamic" };
	if (parseChatRoomId(roomId) !== null) return { tier: "dynamic" };

	return { tier: "deny" };
}
