/** Stable inbox deep link for a feedback thread drawer. */
export function buildFeedbackNotificationHref(feedbackId: string): string {
	return `/home?feedback=${encodeURIComponent(feedbackId)}`;
}

/** Read `feedbackId` from a notification payload. */
export function feedbackIdFromNotificationPayload(
	payload: Record<string, unknown> | null | undefined,
): string | undefined {
	if (!payload) return undefined;
	const id = payload.feedbackId;
	return typeof id === "string" && id.length > 0 ? id : undefined;
}

/** Parse `?feedback=` from the current URL search string. */
export function feedbackIdFromSearch(
	search: string | URLSearchParams,
): string | undefined {
	const params =
		typeof search === "string" ? new URLSearchParams(search) : search;
	const id = params.get("feedback")?.trim();
	return id ? id : undefined;
}
