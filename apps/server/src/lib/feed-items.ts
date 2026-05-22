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
