/** How often the global inbox refetches the unread count while foregrounded (SSE is primary). */
export const NOTIFICATIONS_INBOX_POLL_INTERVAL_MS = 300_000;

export const NOTIFICATIONS_INBOX_FETCH_LIMIT = 80;

/** Derive unread badge count from inbox rows. */
export function computeNotificationsUnreadCount(
	rows: ReadonlyArray<{ readAt: string | null }>,
): number {
	return rows.filter((row) => !row.readAt).length;
}

/** Whether a background poll tick should run (visible tab only). */
export function shouldRunNotificationsInboxPoll(
	visibilityState: DocumentVisibilityState,
): boolean {
	return visibilityState === "visible";
}

/** Optimistic unread-badge decrement when marking a single row read (never negative). */
export function decrementUnread(current: number): number {
	return Math.max(0, current - 1);
}
