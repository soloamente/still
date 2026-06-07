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

/** Composite cursor for signed-in activity infinite scroll. */
export type ActivityFeedCursor = {
	before: string;
	beforeKind: HomeCommunityActivityKind;
	beforeId: string;
};

type FeedSortRow = {
	kind: HomeCommunityActivityKind;
	at: string;
	id: string;
};

const FEED_KIND_RANK: Record<HomeCommunityActivityKind, number> = {
	log: 0,
	review: 1,
	list: 2,
	divergence: 3,
};

function compareFeedRows(a: FeedSortRow, b: FeedSortRow): number {
	const atA = new Date(a.at).getTime();
	const atB = new Date(b.at).getTime();
	const atDiff = atB - atA;
	if (atDiff !== 0) return atDiff;
	const kindDiff = FEED_KIND_RANK[a.kind] - FEED_KIND_RANK[b.kind];
	if (kindDiff !== 0) return kindDiff;
	return b.id.localeCompare(a.id);
}

function feedRowFromItem(item: HomeCommunityActivityItem): FeedSortRow {
	const pl = item.payload as Record<string, unknown>;
	let id = "";
	if (
		item.kind === "log" &&
		pl.log &&
		typeof pl.log === "object" &&
		"id" in pl.log
	) {
		id = String((pl.log as { id: string }).id);
	} else if (
		item.kind === "review" &&
		pl.review &&
		typeof pl.review === "object" &&
		"id" in pl.review
	) {
		id = String((pl.review as { id: string }).id);
	} else if (
		item.kind === "list" &&
		pl.list &&
		typeof pl.list === "object" &&
		"id" in pl.list
	) {
		id = String((pl.list as { id: string }).id);
	} else if (item.kind === "divergence") {
		const mediaId =
			typeof pl.movieId === "number"
				? `m:${pl.movieId}`
				: typeof pl.tvId === "number"
					? `t:${pl.tvId}`
					: "unknown";
		id = mediaId;
	}
	return { kind: item.kind, at: item.at, id };
}

/** Re-sort merged activity pages so appended rows stay newest-first. */
export function sortActivityItems(
	items: HomeCommunityActivityItem[],
): HomeCommunityActivityItem[] {
	return [...items].sort((a, b) =>
		compareFeedRows(feedRowFromItem(a), feedRowFromItem(b)),
	);
}

export function activityFeedCursorFromItem(
	item: HomeCommunityActivityItem,
): ActivityFeedCursor {
	const row = feedRowFromItem(item);
	return {
		before: row.at,
		beforeKind: row.kind,
		beforeId: row.id,
	};
}

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
