/** Feed row kinds shared by `/api/feed` and the home community Activity tab. */
export type HomeCommunityActivityKind = "log" | "review" | "list";

export type HomeCommunityActivityItem = {
	kind: HomeCommunityActivityKind;
	at: string;
	payload: unknown;
};

/** Stable React keys for merged feed rows (server dates may be `Date` or ISO string). */
export function homeCommunityActivityRowKey(
	item: HomeCommunityActivityItem,
): string {
	const pl = item.payload as Record<string, unknown>;
	if (
		item.kind === "log" &&
		pl.log &&
		typeof pl.log === "object" &&
		"id" in pl.log
	) {
		return `log:${(pl.log as { id: string }).id}`;
	}
	if (
		item.kind === "review" &&
		pl.review &&
		typeof pl.review === "object" &&
		"id" in pl.review
	) {
		return `review:${(pl.review as { id: string }).id}`;
	}
	if (
		item.kind === "list" &&
		pl.list &&
		typeof pl.list === "object" &&
		"id" in pl.list
	) {
		return `list:${(pl.list as { id: string }).id}`;
	}
	return `${item.kind}:${item.at}`;
}

/** Normalize API `at` fields for sorting and keys. */
export function coerceActivityTimestamp(value: unknown): string {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") return value;
	return new Date().toISOString();
}
