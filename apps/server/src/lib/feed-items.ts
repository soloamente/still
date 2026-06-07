import { withCoverPosterPaths } from "./list-cover-posters";

type FeedAt = Date | string;

/** Normalize feed sort keys — `Number(Date)` is always NaN. */
export function feedAtMs(at: FeedAt): number {
	if (at instanceof Date) return at.getTime();
	const parsed = new Date(at).getTime();
	return Number.isFinite(parsed) ? parsed : 0;
}

export function serializeFeedAt(at: FeedAt): string {
	return at instanceof Date ? at.toISOString() : String(at);
}

/** Feed row kinds for sort/cursor tiebreak (matches GET /api/feed). */
export type FeedActivityKind = "log" | "review" | "list" | "divergence";

export type FeedSortRow = {
	kind: FeedActivityKind;
	at: FeedAt;
	id: string;
};

/** Lower rank = newer when `at` ties (log before review before list). */
const FEED_KIND_RANK: Record<FeedActivityKind, number> = {
	log: 0,
	review: 1,
	list: 2,
	divergence: 3,
};

/** Descending feed order — newer rows sort first. */
export function compareFeedRows(a: FeedSortRow, b: FeedSortRow): number {
	const atDiff = feedAtMs(b.at) - feedAtMs(a.at);
	if (atDiff !== 0) return atDiff;
	const kindDiff = FEED_KIND_RANK[a.kind] - FEED_KIND_RANK[b.kind];
	if (kindDiff !== 0) return kindDiff;
	return b.id.localeCompare(a.id);
}

export function sortFeedRows<T extends FeedSortRow>(rows: T[]): T[] {
	return [...rows].sort(compareFeedRows);
}

/** True when `row` should appear below `cursor` in the feed (page 2+). */
export function isFeedRowOlderThanCursor(
	row: FeedSortRow,
	cursor: FeedSortRow,
): boolean {
	return compareFeedRows(row, cursor) > 0;
}

/**
 * List activity time: when the list was created or when the latest title was
 * added — not metadata edits via `list.updatedAt`.
 */
export function listActivityAt(
	listRow: { createdAt: FeedAt },
	latestItemAddedAt: FeedAt | null | undefined,
): Date {
	const created =
		listRow.createdAt instanceof Date
			? listRow.createdAt
			: new Date(listRow.createdAt);
	if (!latestItemAddedAt) return created;
	const added =
		latestItemAddedAt instanceof Date
			? latestItemAddedAt
			: new Date(latestItemAddedAt);
	return added.getTime() > created.getTime() ? added : created;
}

type ListPayloadRow = {
	list: { id: string; coverMovieIds: number[]; coverMovieId?: number | null };
	user: unknown;
	profile: unknown;
};

/** Attach `coverPosterPaths` so list activity rows can show real artwork. */
export async function enrichFeedListRows<T extends ListPayloadRow>(
	rows: T[],
): Promise<T[]> {
	if (rows.length === 0) return rows;
	const enriched = await withCoverPosterPaths(rows.map((r) => r.list));
	const byId = new Map(enriched.map((l) => [l.id, l]));
	return rows.map((row) => {
		const list = byId.get(row.list.id) ?? row.list;
		return { ...row, list };
	});
}
