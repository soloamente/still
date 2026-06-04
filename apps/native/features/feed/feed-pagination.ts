import type { ActivityItem } from "./activity-feed-types";

/** Matches the server/web COMMUNITY_ACTIVITY_LIMIT. */
export const FEED_PAGE_SIZE = 40;

/**
 * Cursor for the next `/api/feed` page: the oldest item's `at`. Returns
 * `undefined` when the last page was short, meaning we've reached the end.
 */
export function nextBeforeCursor(lastPage: ActivityItem[]): string | undefined {
	if (lastPage.length < FEED_PAGE_SIZE) return undefined;
	return lastPage[lastPage.length - 1]?.at;
}

export function getDeviceTimeZone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	} catch {
		return "UTC";
	}
}
