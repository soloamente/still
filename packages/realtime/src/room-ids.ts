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

/** List channel id (reserved for future collab; reorder is REST-only today). */
export function listRoomId(listId: string): string {
	return `list:${listId}`;
}

/** Review reader broadcast channel for live comments and reactions. */
export function reviewRoomId(reviewId: string): string {
	return `review:${reviewId}`;
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

/** Private inbox room for notification push events. */
export function userInboxRoomId(userId: string): string {
	return `user:${userId}:inbox`;
}

/** Chat thread delivery room (Wave 2). */
export function chatRoomId(threadId: string): string {
	return `chat:${threadId}`;
}
