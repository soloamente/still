/** How often the global inbox refetches while the tab is foregrounded (safety net with SSE). */
export const NOTIFICATIONS_INBOX_POLL_INTERVAL_MS = 60_000;

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
