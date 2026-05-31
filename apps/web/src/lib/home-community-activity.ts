/** Feed row kinds shared by `/api/feed` and the home community Activity tab. */
export type HomeCommunityActivityKind =
	| "log"
	| "review"
	| "list"
	| "divergence";

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
	if (item.kind === "divergence") {
		const mediaId =
			typeof pl.movieId === "number"
				? `m:${pl.movieId}`
				: typeof pl.tvId === "number"
					? `t:${pl.tvId}`
					: "unknown";
		return `divergence:${mediaId}`;
	}
	return `${item.kind}:${item.at}`;
}

/** Normalize API `at` fields for sorting and keys. */
export function coerceActivityTimestamp(value: unknown): string {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") return value;
	return new Date().toISOString();
}

/** Map `GET /api/feed` JSON into lobby Activity rows (RSC + client refetch). */
export function parseFeedApiActivityItems(
	payload:
		| { items?: { kind: string; at: string | Date; payload: unknown }[] }
		| null
		| undefined,
): HomeCommunityActivityItem[] {
	const activityRaw = payload?.items ?? [];
	return activityRaw
		.filter(
			(
				item,
			): item is {
				kind: HomeCommunityActivityKind;
				at: string | Date;
				payload: unknown;
			} =>
				item.kind === "log" ||
				item.kind === "review" ||
				item.kind === "list" ||
				item.kind === "divergence",
		)
		.map((item) => ({
			kind: item.kind,
			at: coerceActivityTimestamp(item.at),
			payload: item.payload,
		}));
}
